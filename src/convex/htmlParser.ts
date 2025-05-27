"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import * as cheerio from "cheerio";
import { internal } from "./_generated/api";

// Helper function to parse various date formats
function parseDate(dateString: string): number | null {
  if (!dateString) return null;
  
  try {
    // Handle relative dates like "5 hours ago", "2 days ago"
    const relativeMatch = dateString.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const now = Date.now();
      
      switch (unit) {
        case 'hour': return now - (amount * 60 * 60 * 1000);
        case 'day': return now - (amount * 24 * 60 * 60 * 1000);
        case 'week': return now - (amount * 7 * 24 * 60 * 60 * 1000);
        case 'month': return now - (amount * 30 * 24 * 60 * 60 * 1000);
      }
    }
    
    // Handle absolute dates like "May 24, 2025"
    const absoluteDate = new Date(dateString);
    if (!isNaN(absoluteDate.getTime())) {
      return absoluteDate.getTime();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export const parseHtmlPage = internalAction({
  args: {
    url: v.string(),
    htmlConfig: v.optional(v.object({
      articleSelector: v.optional(v.string()),
      titleSelector: v.optional(v.string()),
      contentSelector: v.optional(v.string()),
      linkSelector: v.optional(v.string()),
      dateSelector: v.optional(v.string()),
    })),
  },
  returns: v.array(v.object({
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
  })),
  handler: async (ctx, args) => {
    console.log(`Starting to parse HTML from: ${args.url}`);
    
    try {
      const response = await fetch(args.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${args.url}: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const html = await response.text();
      console.log(`Fetched HTML, length: ${html.length} characters`);
      
      const $ = cheerio.load(html);
      const articles: any[] = [];
      
      // Track all processed articles using URL as the primary key
      const processedArticleUrls = new Set<string>();
      
      // Function to validate and normalize URL
      const normalizeUrl = (url: string, baseUrl: string): string | null => {
        try {
          // Skip empty or invalid URLs
          if (!url || url.trim() === '') return null;
          
          // Handle relative URLs
          const absoluteUrl = url.startsWith('http') ? url : new URL(url, baseUrl).toString();
          
          // Remove query parameters and fragments for comparison
          const urlObj = new URL(absoluteUrl);
          const cleanUrl = `${urlObj.origin}${urlObj.pathname}`.replace(/\/$/, ''); // Remove trailing slash
          
          // Skip if URL is just the base URL
          if (cleanUrl === baseUrl.replace(/\/$/, '')) return null;
          
          return absoluteUrl;
        } catch (error) {
          console.warn(`Invalid URL: ${url}`, error);
          return null;
        }
      };

      // Function to check if two strings are similar (case-insensitive, ignores whitespace)
      const isSimilarContent = (str1: string, str2: string, length = 50): boolean => {
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const norm1 = normalize(str1).substring(0, length);
        const norm2 = normalize(str2).substring(0, length);
        return norm1 === norm2;
      };

      // Function to add an article with deduplication
      const addArticle = (article: { title: string; content: string; originalAddress: string; publicationDate: number }) => {
        try {
          // Skip if title is too short or missing
          if (!article.title || article.title.trim().length < 5) {
            console.log('Skipping article: Title too short or missing');
            return false;
          }
          
          // Normalize and validate URL
          const normalizedUrl = normalizeUrl(article.originalAddress, args.url);
          if (!normalizedUrl) {
            console.log(`Skipping article: Invalid or missing URL for "${article.title}"`);
            return false;
          }
          
          // Update the URL in the article
          article.originalAddress = normalizedUrl;
          
          // Create a unique key based on URL and normalized title
          const normalizedTitle = article.title.toLowerCase().trim();
          const articleKey = `${normalizedUrl}-${normalizedTitle.substring(0, 50)}`;
          
          // Skip if we've already processed this article
          if (processedArticleUrls.has(articleKey)) {
            console.log(`Skipping duplicate article: ${article.title}`);
            return false;
          }
          
          // Extract subtitle if it exists in the content (format is "title\n\nsubtitle")
          const contentParts = article.content.split('\n\n');
          const hasSubtitle = contentParts.length > 1;
          const subtitle = hasSubtitle ? contentParts[1] : '';
          
          // Check for similar articles using multiple criteria
          const isDuplicate = articles.some(a => {
            // Same URL is always a duplicate
            if (a.originalAddress === normalizedUrl) return true;
            
            // Extract subtitle from existing article
            const aContentParts = a.content.split('\n\n');
            const aHasSubtitle = aContentParts.length > 1;
            const aSubtitle = aHasSubtitle ? aContentParts[1] : '';
            
            // 1. Check if titles are similar
            const titlesSimilar = isSimilarContent(a.title, article.title, 40);
            
            // 2. Check if content is similar (first 100 chars)
            const contentSimilar = isSimilarContent(a.content, article.content, 100);
            
            // 3. Check if subtitles are similar (if both articles have them)
            const subtitlesSimilar = hasSubtitle && aHasSubtitle && 
                                   isSimilarContent(aSubtitle, subtitle, 60);
            
            // 4. Check if current subtitle matches another article's title or vice versa
            const subtitleMatchesTitle = (hasSubtitle && isSimilarContent(subtitle, a.title, 40)) ||
                                      (aHasSubtitle && isSimilarContent(aSubtitle, article.title, 40));
            
            // Consider it a duplicate if:
            // - Titles are similar AND (content is similar OR subtitles are similar)
            // - OR content is very similar (first 200 chars)
            // - OR subtitle matches another article's title or vice versa
            return (titlesSimilar && (contentSimilar || subtitlesSimilar)) ||
                   isSimilarContent(a.content, article.content, 200) ||
                   subtitleMatchesTitle;
          });
          
          if (isDuplicate) {
            console.log(`Skipping similar article: ${article.title}`);
            return false;
          }
          
          // Add to processed URLs and articles
          processedArticleUrls.add(articleKey);
          articles.push(article);
          console.log(`Added article: ${article.title}`);
          return true;
        } catch (error) {
          console.error('Error in addArticle:', error);
          return false;
        }
      };
      
      // Function to validate if a date is reasonable (not in the future and not too old)
      const isValidDate = (timestamp: number): boolean => {
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const oneDayInFuture = now + (24 * 60 * 60 * 1000);
        
        return timestamp > oneYearAgo && timestamp < oneDayInFuture;
      };

      // Function to parse date from various formats
      const parseArticleDate = ($element: any): number | null => {
        try {
          // Try to get date from datetime attribute first (most reliable)
          const dateTime = $element.attr('datetime');
          if (dateTime) {
            const date = new Date(dateTime);
            const timestamp = date.getTime();
            if (!isNaN(timestamp) && isValidDate(timestamp)) {
              return timestamp;
            }
          }
          
          // Try to parse from text content
          const dateText = $element.text().trim();
          if (dateText) {
            // Try various date formats
            const dateFormats = [
              // ISO 8601 (2023-01-01T12:00:00Z)
              /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
              // YYYY-MM-DD
              /\b\d{4}-\d{2}-\d{2}\b/,
              // Month DD, YYYY (January 1, 2023)
              /[A-Za-z]+ \d{1,2}, \d{4}/,
              // DD Month YYYY (1 January 2023)
              /\d{1,2} [A-Za-z]+ \d{4}/,
              // Relative dates (2 days ago, 1 week ago)
              /(\d+) (day|week|month|year)s? ago/i
            ];
            
            for (const format of dateFormats) {
              const match = dateText.match(format);
              if (match) {
                try {
                  const dateStr = match[0];
                  const date = new Date(dateStr);
                  const timestamp = date.getTime();
                  if (!isNaN(timestamp) && isValidDate(timestamp)) {
                    return timestamp;
                  }
                } catch (e) {
                  continue;
                }
              }
            }
          }
          
          console.warn('Could not parse valid date from element');
          return null;
        } catch (error) {
          console.warn('Error parsing date:', error);
          return null;
        }
      };
      
      // Special case for Last Week in AI
      if (args.url.includes('lastweekin.ai')) {
        console.log('Detected Last Week in AI website, using specialized parsing');
        
        // Find all article containers
        const articleContainers = $('div[role="article"]');
        console.log(`Found ${articleContainers.length} article containers`);
        
        articleContainers.each((index, container) => {
          try {
            const $container = $(container);
            
            // Find the main article link using data-testid
            const $mainLink = $container.find('a[data-testid="post-preview-title"]');
            if ($mainLink.length === 0) {
              console.log('Skipping container: No title link found');
              return; // Skip if no title link found
            }
            
            let href = $mainLink.attr('href') || '';
            const title = $mainLink.text().trim();
            
            // Skip if no valid title or URL
            if (!title || !href) {
              console.log(`Skipping article: Missing title or URL (Title: ${title}, URL: ${href})`);
              return;
            }
            
            // Ensure the URL is absolute
            if (href && !href.startsWith('http')) {
              href = new URL(href, args.url).toString();
            }
            
            // Skip if URL is just the base URL
            const cleanHref = href.split('?')[0].split('#')[0];
            if (cleanHref === args.url || cleanHref === `${args.url}/`) {
              console.log(`Skipping article: URL is the same as base URL (${cleanHref})`);
              return;
            }
            
            let subtitle = '';
            const $subtitle = $container.find('div:has(> a[data-testid="post-preview-title"])')
              .next('div')
              .find('a')
              .first();
              
            if ($subtitle.length > 0) {
              subtitle = $subtitle.text().trim();
              console.log(`Found subtitle: ${subtitle}`);
            }
            
            // Combine title and subtitle for the content
            const content = subtitle ? `${title}\n\n${subtitle}` : title;
            
            // Find the publication date in the time element
            let publicationDate: number | null = null;
            
            // 1. First try to get date from datetime attribute (most reliable)
            const $timeElement = $container.find('time[datetime]');
            if ($timeElement.length > 0) {
              const dateString = $timeElement.attr('datetime');
              if (dateString) {
                try {
                  const date = new Date(dateString);
                  if (!isNaN(date.getTime())) {
                    publicationDate = date.getTime();
                    console.log(`Found date from datetime: ${dateString} -> ${publicationDate} (${new Date(publicationDate).toISOString()})`);
                  }
                } catch (e) {
                  console.warn(`Failed to parse datetime: ${dateString}`, e);
                }
              }
            }
            
            // 2. Try to parse from time element's text content
            if (!publicationDate) {
              const $timeText = $container.find('time').first();
              if ($timeText.length > 0) {
                const dateText = $timeText.text().trim();
                console.log(`Found date text: ${dateText}`);
                
                // Try various date formats
                const dateFormats = [
                  // ISO 8601 format (e.g., 2025-05-18T01:59:34.341Z)
                  /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)/,
                  // Month Day, Year (e.g., May 18, 2025)
                  /([A-Za-z]+ \d{1,2},? \d{4})/,
                  // Month Day (e.g., May 18) - assumes current year
                  /([A-Za-z]+ \d{1,2})/,
                  // YYYY-MM-DD (e.g., 2025-05-18)
                  /(\d{4}-\d{2}-\d{2})/
                ];
                
                for (const format of dateFormats) {
                  const match = dateText.match(format);
                  if (match) {
                    try {
                      let dateString = match[0];
                      
                      // If we only have month and day, add current year
                      if (dateString.match(/^[A-Za-z]+ \d{1,2}$/)) {
                        dateString = `${dateString}, ${new Date().getFullYear()}`;
                      }
                      
                      // If we don't have a time, set to noon UTC
                      if (!dateString.includes('T') && !dateString.includes(':')) {
                        dateString += 'T12:00:00Z';
                      }
                      
                      const date = new Date(dateString);
                      if (!isNaN(date.getTime())) {
                        publicationDate = date.getTime();
                        console.log(`Parsed date from text (${format}): ${dateString} -> ${publicationDate} (${new Date(publicationDate).toISOString()})`);
                        break;
                      }
                    } catch (e) {
                      console.warn(`Failed to parse date: ${match[0]}`, e);
                    }
                  }
                }
              }
            }
            
            // 3. If still no valid date, use current date at noon UTC as fallback
            if (!publicationDate) {
              const today = new Date();
              today.setUTCHours(12, 0, 0, 0);
              publicationDate = today.getTime();
              console.log('Using current date as fallback');
            }
            
            // Ensure the date is a valid number for Convex
            if (isNaN(publicationDate)) {
              console.warn('Invalid publication date, using current date');
              publicationDate = Date.now();
            }
            
            // Add the article using our deduplication function
            const added = addArticle({
              title: title,
              content: content,
              originalAddress: href, // Use the processed href variable
              publicationDate: publicationDate,
            });
            
            if (added) {
              console.log(`Added article: ${title}`);
            }
          } catch (error) {
            console.error('Error parsing article section:', error);
          }
        });
        
        console.log(`Successfully parsed ${articles.length} articles`);
        
        // Return articles if we found any
        if (articles.length > 0) {
          return articles;
        }
      }
      
      // Try multiple selectors to find articles for other sites
      const selectors = [
        '.cursor-pointer', // Simple class that should match
        'div[class*="cursor-pointer"]', // Any div with cursor-pointer in class
        '.post-preview', // Substack post preview
        '.post', // Generic post class
        'article', // Generic article element
        'h2', // Just find all h2 elements (titles)
      ];
      
      for (const selector of selectors) {
        console.log(`Trying selector: ${selector}`);
        const elements = $(selector);
        console.log(`Found ${elements.length} elements with selector: ${selector}`);
        
        if (selector === '.post-preview' || selector === '.post' || selector === 'article') {
          // Special handling for Substack post previews
          elements.each((index, element) => {
            try {
              const $article = $(element);
              
              // Extract title
              let title = '';
              const $title = $article.find('.post-title, h3, .title, h2');
              if ($title.length > 0) {
                title = $title.first().text().trim();
              }
              
              if (!title || title.length < 5) return;
              
              // Extract content
              let content = '';
              const $content = $article.find('.post-subtitle, p, .summary, .excerpt');
              if ($content.length > 0) {
                $content.each((i, el) => {
                  const text = $(el).text().trim();
                  if (text && text.length > 10) {
                    content += text + ' ';
                  }
                });
              }
              
              if (!content.trim()) {
                content = title;
              }
              
              // Extract link
              let link = '';
              const $link = $article.find('a[href*="/p/"]');
              if ($link.length > 0) {
                link = $link.attr('href') || '';
                // Make sure the link is absolute
                if (link && !link.startsWith('http')) {
                  link = new URL(link, args.url).toString();
                }
              }
              
              if (!link) {
                // Generate a link based on the title as fallback
                const slug = title.toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
                link = `${args.url.split('?')[0]}/${slug}`;
              }
              
              // Extract date
              let publicationDate: number | null = null;
              const $date = $article.find('.post-meta, time, .date');
              if ($date.length > 0) {
                const dateText = $date.first().text().trim();
                const parsedDate = parseDate(dateText);
                if (parsedDate) {
                  publicationDate = parsedDate;
                }
              }
              
              // If no valid date found, use the current time but in a way that's consistent between server and client
              if (!publicationDate) {
                const now = new Date();
                const dateString = now.toISOString();
                publicationDate = new Date(dateString).getTime();
              }
              
              addArticle({
                title: title,
                content: content.trim() || title,
                originalAddress: link,
                publicationDate: publicationDate,
              });
              
            } catch (error) {
              console.error('Error parsing Substack article element:', error);
            }
          });
          
          if (articles.length > 0) {
            console.log(`Successfully found ${articles.length} articles using selector: ${selector}`);
            break; // Stop trying other selectors if we found articles
          }
        } else if (selector === 'h2') {
          // Special handling for h2 elements - find their parent containers
          elements.each((index, element) => {
            try {
              const $title = $(element);
              const title = $title.text().trim();
              
              if (!title || title.length < 10) return;
              
              console.log(`Found title: ${title}`);
              
              // Find the parent container
              const $container = $title.closest('div');
              
              // Look for date in the container
              let publicationDate: number | null = null;
              $container.find('span').each((i, el) => {
                const dateText = $(el).text().trim();
                if (dateText && (dateText.includes('ago') || dateText.includes('May') || dateText.includes('2025'))) {
                  const parsedDate = parseDate(dateText);
                  if (parsedDate) {
                    publicationDate = parsedDate;
                    return false;
                  }
                }
              });
              
              // If no valid date found, use the current time but in a way that's consistent between server and client
              if (!publicationDate) {
                const now = new Date();
                const dateString = now.toISOString();
                publicationDate = new Date(dateString).getTime();
              }
              
              // Look for content in the container
              let content = '';
              $container.find('p').each((i, el) => {
                const text = $(el).text().trim();
                if (text && text.length > 20 && !text.includes('Zain Kahn')) {
                  content += text + ' ';
                }
              });
              
              if (!content.trim()) {
                content = title;
              }
              
              // Generate link
              const slug = title.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
              
              const link = `https://www.superhuman.ai/p/${slug}`;
              
              articles.push({
                title: title,
                content: content.trim() || title,
                originalAddress: link,
                publicationDate: publicationDate,
              });
              
            } catch (error) {
              console.error('Error parsing h2 element:', error);
            }
          });
          
          if (articles.length > 0) {
            console.log(`Successfully found ${articles.length} articles using h2 selector`);
            break; // Stop trying other selectors if we found articles
          }
        } else {
          // Handle other selectors
          elements.each((index, element) => {
            try {
              const $article = $(element);
              
              // Find title
              const $title = $article.find('h2');
              const title = $title.text().trim();
              
              if (!title || title.length < 10) return;
              
              console.log(`Found article: ${title}`);
              
              // Find content
              let content = '';
              $article.find('p').each((i, el) => {
                const text = $(el).text().trim();
                if (text && text.length > 20 && !text.includes('Zain Kahn')) {
                  content += text + ' ';
                }
              });
              
              if (!content.trim()) {
                content = title;
              }
              
              // Find date
              let publicationDate: number | null = null;
              $article.find('span').each((i, el) => {
                const dateText = $(el).text().trim();
                if (dateText && (dateText.includes('ago') || dateText.includes('May') || dateText.includes('2025'))) {
                  const parsedDate = parseDate(dateText);
                  if (parsedDate) {
                    publicationDate = parsedDate;
                    return false;
                  }
                }
              });
              
              // If no valid date found, use the current time but in a way that's consistent between server and client
              if (!publicationDate) {
                const now = new Date();
                const dateString = now.toISOString();
                publicationDate = new Date(dateString).getTime();
              }
              
              // Generate link
              const slug = title.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
              
              const link = `https://www.superhuman.ai/p/${slug}`;
              
              articles.push({
                title: title,
                content: content.trim() || title,
                originalAddress: link,
                publicationDate: publicationDate,
              });
              
            } catch (error) {
              console.error('Error parsing article element:', error);
            }
          });
          
          if (articles.length > 0) {
            console.log(`Successfully found ${articles.length} articles using selector: ${selector}`);
            break; // Stop trying other selectors if we found articles
          }
        }
      }
      
      console.log(`Final result: ${articles.length} articles parsed`);
      
      if (articles.length > 0) {
        console.log('Sample articles:', articles.slice(0, 2).map(a => ({ title: a.title, content: a.content.substring(0, 100) })));
      }
      
      return articles;
      
    } catch (error) {
      console.error('Error in parseHtmlPage:', error);
      return [];
    }
  },
});

export const importFromHtmlSource = internalAction({
  args: {
    id: v.id("feedSources"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const feedSource = await ctx.runQuery(internal.feedSources.getFeedById, {
        id: args.id,
      });

      if (!feedSource) {
        console.error('Feed source not found');
        return null;
      }

      console.log(`Importing from HTML source: ${feedSource.name} (${feedSource.sourceAddress})`);

      const articles = await ctx.runAction(internal.htmlParser.parseHtmlPage, {
        url: feedSource.sourceAddress,
        htmlConfig: feedSource.htmlConfig || {},
      });

      console.log(`Parsed ${articles.length} articles from HTML`);

      let newArticlesCount = 0;
      let duplicatesCount = 0;

      for (const article of articles) {
        try {
          const result = await ctx.runMutation(internal.feedSources.addArticleFromFeed, {
            title: article.title,
            content: article.content,
            originalAddress: article.originalAddress,
            publicationDate: article.publicationDate,
            sourceFeedName: feedSource.name,
            sourceFeedId: feedSource._id,
          });

          if (result === null) {
            // Article was a duplicate
            duplicatesCount++;
          } else {
            // New article was added
            newArticlesCount++;
          }
        } catch (error) {
          console.error('Error adding article:', error);
        }
      }

      console.log(`HTML import complete: ${newArticlesCount} new articles, ${duplicatesCount} duplicates skipped`);

    } catch (error) {
      console.error('Error in importFromHtmlSource:', error);
      return null;
    }
  },
});