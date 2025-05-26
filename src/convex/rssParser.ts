"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const parseRssFeed = internalAction({
  args: { url: v.string() },
  returns: v.array(v.object({
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
  })),
  handler: async (ctx, args) => {
    try {
      console.log(`Fetching RSS from ${args.url}`);
      
      const response = await fetch(args.url);
      const text = await response.text();
      
      const articles: any[] = [];
      
      // Simple RSS parsing using regex (basic but works for most feeds)
      const itemMatches = text.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
      
      console.log(`Found ${itemMatches.length} RSS items`);
      
      for (const itemText of itemMatches) {
        try {
          // Extract title
          const titleMatch = itemText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'Untitled';
          
          // Extract description/content
          const descMatch = itemText.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
                           itemText.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
          const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
          
          // Extract link
          const linkMatch = itemText.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ||
                           itemText.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
          const link = linkMatch ? linkMatch[1].trim() : '';
          
          // Extract publication date
          const pubDateMatch = itemText.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
                              itemText.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
          const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
          
          // Parse publication date
          let publicationDate = Date.now();
          if (pubDate) {
            const parsed = new Date(pubDate);
            if (!isNaN(parsed.getTime())) {
              publicationDate = parsed.getTime();
            }
          }
          
          // Clean up content - remove HTML tags for basic text
          const cleanContent = description.replace(/<[^>]*>/g, '').trim();
          
          if (title && cleanContent) {
            articles.push({
              title: title.substring(0, 200), // Limit title length
              content: cleanContent.substring(0, 2000), // Limit content length
              originalAddress: link || args.url,
              publicationDate,
            });
          }
        } catch (itemError) {
          console.error('Error parsing RSS item:', itemError);
        }
      }
      
      // Also try Atom format
      if (articles.length === 0) {
        const entryMatches = text.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
        console.log(`Found ${entryMatches.length} Atom entries`);
        
        for (const entryText of entryMatches) {
          try {
            // Extract title
            const titleMatch = entryText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'Untitled';
            
            // Extract content
            const contentMatch = entryText.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ||
                                entryText.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
            const content = contentMatch ? contentMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
            
            // Extract link
            const linkMatch = entryText.match(/<link[^>]*href=["']([^"']*?)["'][^>]*>/i) ||
                             entryText.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
            const link = linkMatch ? linkMatch[1].trim() : '';
            
            // Extract date
            const dateMatch = entryText.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
                             entryText.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
            const dateStr = dateMatch ? dateMatch[1].trim() : '';
            
            // Parse publication date
            let publicationDate = Date.now();
            if (dateStr) {
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                publicationDate = parsed.getTime();
              }
            }
            
            // Clean up content
            const cleanContent = content.replace(/<[^>]*>/g, '').trim();
            
            if (title && cleanContent) {
              articles.push({
                title: title.substring(0, 200),
                content: cleanContent.substring(0, 2000),
                originalAddress: link || args.url,
                publicationDate,
              });
            }
          } catch (itemError) {
            console.error('Error parsing Atom entry:', itemError);
          }
        }
      }
      
      console.log(`Successfully parsed ${articles.length} articles from RSS/Atom feed`);
      return articles;
      
    } catch (error) {
      console.error('Error parsing RSS feed:', error);
      return [];
    }
  },
});

export const importFromRssSource = internalAction({
  args: { id: v.id("feedSources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const feedSource = await ctx.runQuery(internal.feedSources.getFeedById, {
      id: args.id,
    });
    
    if (!feedSource) {
      console.error('Feed source not found');
      return null;
    }
    
    console.log(`Importing from RSS source: ${feedSource.name}`);
    
    try {
      const articles = await ctx.runAction(internal.rssParser.parseRssFeed, {
        url: feedSource.sourceAddress,
      });
      
      console.log(`Parsed ${articles.length} articles from RSS`);
      
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
      
      console.log(`RSS import complete: ${newArticlesCount} new articles, ${duplicatesCount} duplicates skipped`);
      
    } catch (error) {
      console.error('Error importing from RSS source:', error);
    }
    
    return null;
  },
});

export const testRssFeed = internalAction({
  args: { url: v.string() },
  returns: v.object({
    success: v.boolean(),
    articleCount: v.number(),
    error: v.optional(v.string()),
    sampleTitle: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    articleCount: number;
    error?: string;
    sampleTitle?: string;
  }> => {
    try {
      console.log(`Testing RSS feed: ${args.url}`);
      
      const response = await fetch(args.url);
      if (!response.ok) {
        return {
          success: false,
          articleCount: 0,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      const text = await response.text();
      console.log(`RSS content length: ${text.length} characters`);
      console.log(`First 500 characters: ${text.substring(0, 500)}`);
      
      // Call parseRssFeed directly instead of through ctx.runAction to avoid circular reference
      const articles: Array<{
        title: string;
        content: string;
        originalAddress: string;
        publicationDate: number;
      }> = [];
      
      // Simple RSS parsing using regex (same logic as parseRssFeed)
      const itemMatches = text.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
      console.log(`Found ${itemMatches.length} RSS items`);
      
      for (const itemText of itemMatches) {
        try {
          const titleMatch = itemText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'Untitled';
          
          const descMatch = itemText.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
          const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
          
          const linkMatch = itemText.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
          const link = linkMatch ? linkMatch[1].trim() : '';
          
          const cleanContent = description.replace(/<[^>]*>/g, '').trim();
          
          if (title && cleanContent) {
            articles.push({
              title: title.substring(0, 200),
              content: cleanContent.substring(0, 2000),
              originalAddress: link || args.url,
              publicationDate: Date.now(),
            });
          }
        } catch (itemError) {
          console.error('Error parsing RSS item:', itemError);
        }
      }
      
      return {
        success: true,
        articleCount: articles.length,
        sampleTitle: articles.length > 0 ? articles[0].title : undefined,
      };
      
    } catch (error) {
      console.error('Test RSS error:', error);
      return {
        success: false,
        articleCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});