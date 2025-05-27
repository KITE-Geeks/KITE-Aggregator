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
      
      // Track the original domain of the feed
      let feedDomain: string | null = null;
      try {
        feedDomain = new URL(args.url).hostname;
        console.log(`Feed domain set to: ${feedDomain}`);
      } catch (e) {
        console.warn(`Could not parse feed domain from URL: ${args.url}`);
      }

      // Function to validate and normalize URL
      const normalizeUrl = (url: string, baseUrl: string): string | null => {
        try {
          // Skip empty or invalid URLs
          if (!url || url.trim() === '' || url.trim() === '#') {
            console.log(`Skipping empty or invalid URL: "${url}"`);
            return null;
          }
          
          // Clean up the URL
          let cleanUrl = url.trim();
          
          // Handle mailto: and other non-http protocols
          if (cleanUrl.startsWith('mailto:') || cleanUrl.startsWith('tel:') || 
              cleanUrl.startsWith('javascript:') || cleanUrl.startsWith('#')) {
            console.log(`Skipping non-http URL: "${cleanUrl}"`);
            return null;
          }
          
          // Handle protocol-relative URLs (starting with //)
          if (cleanUrl.startsWith('//')) {
            cleanUrl = 'https:' + cleanUrl;
          }
          // Handle root-relative URLs
          else if (cleanUrl.startsWith('/')) {
            const base = new URL(baseUrl);
            cleanUrl = `${base.protocol}//${base.host}${cleanUrl}`;
          }
          // Handle relative URLs (without protocol)
          else if (!cleanUrl.startsWith('http')) {
            // Ensure baseUrl ends with a slash for proper relative URL resolution
            const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            cleanUrl = new URL(cleanUrl, normalizedBase).toString();
          }
          
          // Create URL object for further processing
          const urlObj = new URL(cleanUrl);
          
          // Check if this URL points to a different domain than our feed
          if (feedDomain && urlObj.hostname !== feedDomain) {
            console.log(`External URL detected (${urlObj.hostname} vs ${feedDomain}): "${cleanUrl}"`);
            
            // If this is a cross-feed link, we might want to treat it differently
            // For now, we'll keep it but log it
            console.log(`Cross-feed link detected: ${cleanUrl}`);
          }
          
          // Normalize the URL
          let normalizedUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
          
          // Remove common tracking parameters
          const trackingParams = ['utm_', 'ref_', 'source', 'cmp', 'campaign', 'fbclid', 'gclid', 'msclkid'];
          const searchParams = new URLSearchParams(urlObj.search);
          
          // Remove tracking parameters
          for (const param of searchParams.keys()) {
            if (trackingParams.some(tp => param.startsWith(tp))) {
              searchParams.delete(param);
            }
          }
          
          // Rebuild the search string if we have remaining parameters
          const searchString = searchParams.toString();
          
          // Remove trailing slash for consistency
          normalizedUrl = normalizedUrl.replace(/\/$/, '');
          
          // Skip if URL is just the base URL
          const baseUrlObj = new URL(baseUrl);
          const baseNormalized = `${baseUrlObj.protocol}//${baseUrlObj.host}${baseUrlObj.pathname}`.replace(/\/$/, '');
          
          if (normalizedUrl === baseNormalized) {
            console.log(`Skipping URL as it matches base URL: ${normalizedUrl}`);
            return null;
          }
          
          // Rebuild URL with cleaned up components
          const result = new URL(normalizedUrl);
          
          // Add back non-tracking query parameters
          if (searchString) {
            result.search = searchString;
          }
          
          // Ensure we're using HTTPS for security
          if (result.protocol === 'http:') {
            result.protocol = 'https:';
            console.log(`Upgraded to HTTPS: ${result.toString()}`);
          }
          
          console.log(`Normalized URL: "${url}" -> "${result.toString()}"`);
          return result.toString();
          
        } catch (error) {
          console.warn(`Invalid URL: "${url}" with base "${baseUrl}"`, error);
          return null;
        }
      };

      // Function to check if two strings are similar (case-insensitive, ignores whitespace)
      const isSimilarContent = (str1: string, str2: string, length = 50): boolean => {
        if (!str1 || !str2) return false;
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const norm1 = normalize(str1).substring(0, length);
        const norm2 = normalize(str2).substring(0, length);
        return norm1 === norm2 && norm1.length > 10; // Ensure minimum length for meaningful comparison
      };

      // Function to add an article without duplicate checking
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
          
          // Add to articles array for later processing
          articles.push(article);
          console.log(`Added article for processing: ${article.title}`);
          return true;
        } catch (error) {
          console.error('Error in addArticle:', error);
          return false;
        }
      };
      
      // Function to remove duplicate articles after parsing
      const removeDuplicates = (articles: any[]) => {
        const uniqueArticles: any[] = [];
        const processedUrls = new Set<string>();
        const processedTitles = new Set<string>();
        
        // Sort by publication date (newest first) to keep the most recent version
        const sortedArticles = [...articles].sort((a, b) => b.publicationDate - a.publicationDate);
        
        for (const article of sortedArticles) {
          try {
            const normalizedUrl = article.originalAddress.toLowerCase().split('?')[0].split('#')[0];
            const normalizedTitle = article.title.toLowerCase().trim();
            
            // Extract subtitle if it exists
            const contentParts = article.content.split('\n\n');
            const hasSubtitle = contentParts.length > 1;
            const subtitle = hasSubtitle ? contentParts[1] : '';
            
            // Create a unique key for this article
            const articleKey = `${normalizedUrl}-${normalizedTitle.substring(0, 50)}`;
            
            // Check for duplicates
            const isDuplicate = Array.from(processedUrls).some(url => {
              // Check URL similarity
              if (url === normalizedUrl) return true;
              
              // Check if this is a similar URL (same path but different params)
              const url1 = new URL(url);
              const url2 = new URL(normalizedUrl);
              if (url1.pathname === url2.pathname && url1.hostname === url2.hostname) {
                return true;
              }
              
              return false;
            }) || Array.from(processedTitles).some(title => {
              // Check title similarity
              if (isSimilarContent(title, normalizedTitle, 40)) return true;
              
              // Check if subtitle matches another title
              if (hasSubtitle && isSimilarContent(subtitle, title, 40)) return true;
              
              return false;
            });
            
            if (!isDuplicate) {
              uniqueArticles.push(article);
              processedUrls.add(normalizedUrl);
              processedTitles.add(normalizedTitle);
              
              // Also add the subtitle as a title for future comparisons
              if (hasSubtitle) {
                processedTitles.add(subtitle.toLowerCase().trim());
              }
            } else {
              console.log(`Removing duplicate article: ${article.title}`);
            }
          } catch (error) {
            console.error('Error processing article for deduplication:', error);
            // Keep the article if there was an error processing it
            uniqueArticles.push(article);
          }
        }
        
        console.log(`Removed ${articles.length - uniqueArticles.length} duplicate articles`);
        return uniqueArticles;
      };
      
      // Function to validate if a date is reasonable (not in the future and not too old)
      const isValidDate = (timestamp: number): boolean => {
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const oneDayInFuture = now + (24 * 60 * 60 * 1000);
        
        return timestamp > oneYearAgo && timestamp < oneDayInFuture;
      };

      // Function to parse date from various formats with detailed logging
      const parseArticleDate = ($element: any): number | null => {
        const logPrefix = '[Date Parse]';
        
        try {
          // 1. Try to get date from datetime attribute (most reliable)
          const dateTime = $element.attr('datetime');
          if (dateTime) {
            console.log(`${logPrefix} Found datetime attribute: ${dateTime}`);
            const date = new Date(dateTime);
            const timestamp = date.getTime();
            if (!isNaN(timestamp) && isValidDate(timestamp)) {
              console.log(`${logPrefix} Successfully parsed from datetime: ${dateTime} -> ${new Date(timestamp).toISOString()}`);
              return timestamp;
            }
            console.log(`${logPrefix} Invalid datetime format: ${dateTime}`);
          }
          
          // 2. Try to parse from text content
          const dateText = $element.text().trim();
          if (dateText) {
            console.log(`${logPrefix} Trying to parse date from text: "${dateText}"`);
            
            // Try various date formats with different parsing strategies
            const parseAttempts = [
              // ISO 8601 formats
              () => new Date(dateText),
              // Common date strings
              () => new Date(dateText.replace(/(\d+)(st|nd|rd|th)/, '$1')), // Handle "1st", "2nd", etc.
              // Custom formats
              () => {
                const match = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); // YYYY-MM-DD
                return match ? new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`) : null;
              },
              () => {
                const match = dateText.match(/([A-Za-z]+) (\d{1,2}),? (\d{4})/); // Month DD, YYYY
                return match ? new Date(`${match[1]} ${match[2]}, ${match[3]}`) : null;
              },
              // Relative dates (e.g., "2 days ago")
              () => {
                const match = dateText.match(/(\d+) (day|week|month|year)s? ago/i);
                if (!match) return null;
                const amount = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                const date = new Date();
                
                switch(unit) {
                  case 'day': date.setDate(date.getDate() - amount); break;
                  case 'week': date.setDate(date.getDate() - (amount * 7)); break;
                  case 'month': date.setMonth(date.getMonth() - amount); break;
                  case 'year': date.setFullYear(date.getFullYear() - amount); break;
                }
                
                return date;
              }
            ];
            
            for (const parseFn of parseAttempts) {
              try {
                const date = parseFn();
                if (date && !isNaN(date.getTime())) {
                  const timestamp = date.getTime();
                  if (isValidDate(timestamp)) {
                    console.log(`${logPrefix} Successfully parsed: "${dateText}" -> ${new Date(timestamp).toISOString()}`);
                    return timestamp;
                  }
                }
              } catch (e) {
                // Silently continue to next parsing attempt
                continue;
              }
            }
          }
          
          // 3. Try to find a date in parent elements
          const parentDate = $element.parents().map((i: number, el: any) => {
            const $el = $(el);
            const dt = $el.attr('datetime');
            if (dt) {
              const d = new Date(dt);
              if (!isNaN(d.getTime()) && isValidDate(d.getTime())) {
                console.log(`${logPrefix} Found date in parent element: ${dt}`);
                return d.getTime();
              }
            }
            return null;
          }).get().find((d: any) => d !== null);
          
          if (parentDate) return parentDate;
          
          console.warn(`${logPrefix} Could not parse valid date from element or its parents`);
          return null;
          
        } catch (error) {
          console.error(`${logPrefix} Error parsing date:`, error);
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
            console.log('Looking for time element with datetime attribute');
            
            if ($timeElement.length > 0) {
              const dateString = $timeElement.attr('datetime');
              console.log(`Found datetime attribute: ${dateString}`);
              
              if (dateString) {
                try {
                  const date = new Date(dateString);
                  if (!isNaN(date.getTime())) {
                    publicationDate = date.getTime();
                    console.log(`Successfully parsed date from datetime: ${dateString} -> ${new Date(publicationDate).toISOString()}`);
                    
                    // Add fallback to check if the time element's text contains a date
                    const timeText = $timeElement.text().trim();
                    if (timeText) {
                      console.log(`Time element text: "${timeText}"`);
                      const textDate = parseArticleDate($timeElement);
                      if (textDate && textDate !== publicationDate) {
                        console.log(`Found different date in time text: ${new Date(textDate).toISOString()}`);
                      }
                    }
                  } else {
                    console.warn(`Invalid date format in datetime: ${dateString}`);
                  }
                } catch (e) {
                  console.warn(`Failed to parse datetime: ${dateString}`, e);
                }
              } else {
                console.warn('Empty datetime attribute found');
              }
            } else {
              console.log('No time element with datetime attribute found');
            }
            
            // 2. Try to parse from time element's text content if datetime attribute wasn't found
            if (!publicationDate) {
              console.log('Trying to find date in time element text content');
              const $timeElements = $container.find('time');
              console.log(`Found ${$timeElements.length} time elements`);
              
              for (let i = 0; i < $timeElements.length; i++) {
                const $timeText = $($timeElements[i]);
                // Skip if this is the same element we already checked for datetime attribute
                if ($timeText.is($timeElement)) continue;
                
                const dateText = $timeText.text().trim();
                if (!dateText) continue;
                
                console.log(`Checking time element #${i + 1} with text: "${dateText}"`);
                
                // Try parsing with our main date parser first
                const parsedDate = parseArticleDate($timeText);
                if (parsedDate) {
                  publicationDate = parsedDate;
                  console.log(`Successfully parsed date from time text: ${dateText} -> ${new Date(publicationDate).toISOString()}`);
                  break;
                }
                
                // Fallback to direct parsing
                try {
                  // Try common date formats
                  const date = new Date(dateText);
                  if (!isNaN(date.getTime())) {
                    publicationDate = date.getTime();
                    console.log(`Directly parsed date from text: ${dateText} -> ${new Date(publicationDate).toISOString()}`);
                    break;
                  }
                } catch (e) {
                  console.warn(`Failed to directly parse date: ${dateText}`, e);
                }
              }
              
              if (!publicationDate) {
                console.log('No valid date found in time elements');
              }
            }
            
            // 3. Look for dates in other common elements if still not found
            if (!publicationDate) {
              console.log('Trying to find date in other common elements');
              const possibleDateContainers = [
                { selector: '[class*="date"]', desc: 'element with "date" in class' },
                { selector: '[class*="time"]', desc: 'element with "time" in class' },
                { selector: 'time', desc: 'any time element' },
                { selector: 'span', desc: 'span elements' },
                { selector: 'div', desc: 'div elements' }
              ];
              
              for (const container of possibleDateContainers) {
                console.log(`Looking for dates in ${container.desc}`);
                const $elements = $container.find(container.selector);
                console.log(`Found ${$elements.length} ${container.desc} elements`);
                
                for (let i = 0; i < Math.min($elements.length, 10); i++) {
                  const $el = $($elements[i]);
                  const text = $el.text().trim();
                  if (!text || text.length > 50) continue; // Skip long text that's probably not a date
                  
                  console.log(`Checking element #${i + 1} with text: "${text}"`);
                  const parsedDate = parseArticleDate($el);
                  if (parsedDate) {
                    publicationDate = parsedDate;
                    console.log(`Found date in ${container.desc}: ${text} -> ${new Date(publicationDate).toISOString()}`);
                    break;
                  }
                }
                
                if (publicationDate) break;
              }
            }
            
            // 4. If still no valid date, use current date at noon UTC as fallback
            if (!publicationDate) {
              const today = new Date();
              today.setUTCHours(12, 0, 0, 0);
              publicationDate = today.getTime();
              console.warn('Using current date as fallback - no valid date found in article');
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
        
        // Remove duplicates before returning
        const uniqueArticles = removeDuplicates(articles);
        
        // Return unique articles if we found any
        if (uniqueArticles.length > 0) {
          console.log(`Returning ${uniqueArticles.length} unique articles`);
          return uniqueArticles;
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