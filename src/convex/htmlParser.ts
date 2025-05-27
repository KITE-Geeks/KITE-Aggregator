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
      
      // Function to ensure URLs are properly resolved against the base URL
      const resolveUrl = (url: string, baseUrl: string): string => {
        try {
          if (!url) return '';
          
          // If it's already an absolute URL, return it as is
          if (url.startsWith('http')) {
            return url;
          }
          
          // Handle protocol-relative URLs
          if (url.startsWith('//')) {
            const base = new URL(baseUrl);
            return `${base.protocol}${url}`;
          }
          
          // Handle root-relative URLs
          if (url.startsWith('/')) {
            const base = new URL(baseUrl);
            return `${base.origin}${url}`;
          }
          
          // Handle relative URLs
          const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
          return new URL(url, base).toString();
          
        } catch (error) {
          console.error(`Error resolving URL: ${url} with base ${baseUrl}`, error);
          return url; // Return original if we can't resolve it
        }
      };
      
      // Track the base URL of the feed
      const feedBaseUrl = new URL(args.url);
      feedBaseUrl.pathname = ''; // Remove path to get the base URL
      const cleanBaseUrl = feedBaseUrl.toString().replace(/\/$/, ''); // Remove trailing slash
      
      console.log(`Feed base URL: ${cleanBaseUrl}`);

      // Special case for Last Week in AI
      if (args.url.includes('lastweekin.ai')) {
        console.log('Detected Last Week in AI website, using specialized parsing');
        
        // Find all article containers - each article is in a div with role="article"
        const articleContainers = $('div[role="article"]');
        console.log(`Found ${articleContainers.length} article containers`);
        
        // Track processed URLs to avoid duplicates
        const processedUrls = new Set<string>();
        
        articleContainers.each((index, container) => {
          try {
            const $container = $(container);
            
            // Find the main article link using data-testid
            const $mainLink = $container.find('a[data-testid="post-preview-title"]');
            let href = $mainLink.attr('href') || '';
            let title = $mainLink.text().trim();
            
            // Skip if no valid title or URL
            if (!title || title.length < 5 || !href) return;
            
            // Resolve the URL against the feed's base URL
            const fullUrl = resolveUrl(href, cleanBaseUrl);
            
            // Skip if the URL is just the base URL
            if (fullUrl === cleanBaseUrl) {
              console.log(`Skipping article with URL matching base: ${fullUrl}`);
              return;
            }
            
            console.log(`Resolved URL: ${href} -> ${fullUrl}`);
            
            // Skip if we've already processed this URL
            if (processedUrls.has(fullUrl)) return;
            processedUrls.add(fullUrl);
            
            // Find the subtitle (in the next div after the title's parent div)
            let subtitle = '';
            const $subtitle = $mainLink.closest('div').next('div').find('a').first();
            if ($subtitle.length > 0) {
              subtitle = $subtitle.text().trim();
              console.log(`Found subtitle: ${subtitle}`);
            }
            
            // Combine title and subtitle for the content
            let content = title;
            if (subtitle) {
              content = `${title}\n\n${subtitle}`;
            }
            
            // Find the publication date in the time element
            let publicationDate: number | null = null;
            
            // First try to get the date from the datetime attribute
            const $dateElement = $container.find('time[datetime]');
            if ($dateElement.length > 0) {
              const dateString = $dateElement.attr('datetime');
              if (dateString) {
                publicationDate = new Date(dateString).getTime();
                console.log(`Found date from datetime: ${dateString} -> ${publicationDate}`);
              }
            }
            
            // If no valid date found, look for date text in time element
            if (!publicationDate || isNaN(publicationDate)) {
              const $dateTextElement = $container.find('time').first();
              if ($dateTextElement.length > 0) {
                const dateText = $dateTextElement.text().trim();
                console.log(`Found date text: ${dateText}`);
                // Try to parse the date text (e.g., 'May 18')
                const dateMatch = dateText.match(/([A-Za-z]+ \d{1,2})/);
                if (dateMatch) {
                  const dateString = `${dateMatch[0]}, ${new Date().getFullYear()} 12:00:00 UTC`;
                  publicationDate = new Date(dateString).getTime();
                  console.log(`Parsed date from text: ${dateString} -> ${publicationDate}`);
                }
              }
            }
            
            // If still no date, try to find a timestamp in the URL
            if (!publicationDate && href) {
              const dateMatch = href.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
              if (dateMatch) {
                const [_, year, month, day] = dateMatch;
                const dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
                const parsedDate = new Date(dateString).getTime();
                if (!isNaN(parsedDate)) {
                  publicationDate = parsedDate;
                }
              }
            }
            
            // If still no date, use the current date at noon UTC (as a last resort)
            if (!publicationDate) {
              const today = new Date();
              today.setUTCHours(12, 0, 0, 0);
              publicationDate = today.getTime();
            }
            
            // Add the article
            articles.push({
              title: title,
              content: content,
              originalAddress: fullUrl,
              publicationDate: publicationDate,
            });
            
            console.log(`Parsed article: ${title} (${new Date(publicationDate).toISOString()})`);
            
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
              
              articles.push({
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