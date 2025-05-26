import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Demo user ID - in a real app, this would come from authentication
const DEMO_USER_ID = "demo-user";

// Get all feed sources
export const getFeedSources = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("feedSources"),
    _creationTime: v.number(),
    name: v.string(),
    sourceAddress: v.string(),
    sourceType: v.union(v.literal("rss"), v.literal("html")),
    lastChecked: v.optional(v.number()),
    isActive: v.boolean(),
    userId: v.optional(v.string()),
    htmlConfig: v.optional(v.object({
      articleSelector: v.optional(v.string()),
      titleSelector: v.optional(v.string()),
      contentSelector: v.optional(v.string()),
      linkSelector: v.optional(v.string()),
      dateSelector: v.optional(v.string()),
    })),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("feedSources").collect();
  },
});

// Add a new feed source
export const addFeedSource = mutation({
  args: {
    name: v.string(),
    sourceAddress: v.string(),
    sourceType: v.union(v.literal("rss"), v.literal("html")),
    htmlConfig: v.optional(v.object({
      articleSelector: v.optional(v.string()),
      titleSelector: v.optional(v.string()),
      contentSelector: v.optional(v.string()),
      linkSelector: v.optional(v.string()),
      dateSelector: v.optional(v.string()),
    })),
  },
  returns: v.id("feedSources"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedSources", {
      name: args.name,
      sourceAddress: args.sourceAddress,
      sourceType: args.sourceType,
      isActive: true,
      userId: DEMO_USER_ID,
      htmlConfig: args.htmlConfig,
    });
  },
});

// Delete a feed source and optionally clean up its articles
export const deleteFeedSource = mutation({
  args: { 
    id: v.id("feedSources"),
    deleteArticles: v.optional(v.boolean())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.deleteArticles) {
      // Delete all articles from this feed source
      const articles = await ctx.db
        .query("articles")
        .withIndex("by_feed", (q) => q.eq("sourceFeedId", args.id))
        .collect();
      
      for (const article of articles) {
        await ctx.db.delete(article._id);
      }
    }
    
    await ctx.db.delete(args.id);
    return null;
  },
});

// Clean up orphaned articles (articles whose feed source no longer exists)
export const cleanupOrphanedArticles = mutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    affectedFeeds: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const articles = await ctx.db.query("articles").collect();
    const feedSources = await ctx.db.query("feedSources").collect();
    const feedSourceIds = new Set(feedSources.map(fs => fs._id));
    
    let deletedCount = 0;
    const affectedFeeds = new Set<string>();
    
    for (const article of articles) {
      if (!feedSourceIds.has(article.sourceFeedId)) {
        await ctx.db.delete(article._id);
        deletedCount++;
        affectedFeeds.add(article.sourceFeedName);
      }
    }
    
    return {
      deletedCount,
      affectedFeeds: Array.from(affectedFeeds),
    };
  },
});

// Update all feeds
export const updateAllFeeds = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const feedSources = await ctx.runQuery(internal.feedSources.getAllFeedSources);
    
    for (const feedSource of feedSources) {
      try {
        if (feedSource.sourceType === "rss") {
          await ctx.runAction(internal.rssParser.importFromRssSource, {
            id: feedSource._id,
          });
        } else if (feedSource.sourceType === "html") {
          await ctx.runAction(internal.htmlParser.importFromHtmlSource, {
            id: feedSource._id,
          });
        }
        
        await ctx.runMutation(internal.feedSources.updateFeedLastChecked, {
          id: feedSource._id,
        });
      } catch (error) {
        console.error(`Error updating feed ${feedSource.name}:`, error);
      }
    }
    
    return null;
  },
});

// Internal function to get all feed sources
export const getAllFeedSources = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("feedSources"),
    _creationTime: v.number(),
    name: v.string(),
    sourceAddress: v.string(),
    sourceType: v.union(v.literal("rss"), v.literal("html")),
    lastChecked: v.optional(v.number()),
    isActive: v.boolean(),
    userId: v.optional(v.string()),
    htmlConfig: v.optional(v.object({
      articleSelector: v.optional(v.string()),
      titleSelector: v.optional(v.string()),
      contentSelector: v.optional(v.string()),
      linkSelector: v.optional(v.string()),
      dateSelector: v.optional(v.string()),
    })),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("feedSources").collect();
  },
});

// Update feed last checked time
export const updateFeedLastChecked = internalMutation({
  args: { id: v.id("feedSources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastChecked: Date.now(),
    });
    return null;
  },
});

// Get feed by ID
export const getFeedById = internalQuery({
  args: { id: v.id("feedSources") },
  returns: v.union(v.object({
    _id: v.id("feedSources"),
    _creationTime: v.number(),
    name: v.string(),
    sourceAddress: v.string(),
    sourceType: v.union(v.literal("rss"), v.literal("html")),
    lastChecked: v.optional(v.number()),
    isActive: v.boolean(),
    userId: v.optional(v.string()),
    htmlConfig: v.optional(v.object({
      articleSelector: v.optional(v.string()),
      titleSelector: v.optional(v.string()),
      contentSelector: v.optional(v.string()),
      linkSelector: v.optional(v.string()),
      dateSelector: v.optional(v.string()),
    })),
  }), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Add article from feed with duplicate checking
export const addArticleFromFeed = internalMutation({
  args: {
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
    sourceFeedName: v.string(),
    sourceFeedId: v.id("feedSources"),
    userId: v.optional(v.string()),
  },
  returns: v.union(v.id("articles"), v.null()),
  handler: async (ctx, args) => {
    // Check if article is older than 2 years
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000);
    if (args.publicationDate < twoYearsAgo) {
      console.log(`Skipping old article: ${args.title} (${new Date(args.publicationDate).toDateString()})`);
      return null; // Don't import articles older than 2 years
    }

    // Check if article already exists
    const existingArticle = await ctx.db
      .query("articles")
      .filter((q) => 
        q.and(
          q.eq(q.field("title"), args.title),
          q.eq(q.field("sourceFeedId"), args.sourceFeedId)
        )
      )
      .first();

    if (existingArticle) {
      console.log(`Article already exists: ${args.title}`);
      return null; // Article already exists
    }

    // Insert new article
    const articleId = await ctx.db.insert("articles", {
      title: args.title,
      content: args.content,
      originalAddress: args.originalAddress,
      publicationDate: args.publicationDate,
      sourceFeedName: args.sourceFeedName,
      sourceFeedId: args.sourceFeedId,
      userId: args.userId,
    });

    console.log(`Added new article: ${args.title}`);
    return articleId;
  },
});

// Check if article exists (for duplicate detection)
export const checkArticleExists = query({
  args: {
    title: v.string(),
    sourceFeedId: v.id("feedSources"),
  },
  returns: v.union(v.object({
    _id: v.id("articles"),
    _creationTime: v.number(),
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
    sourceFeedName: v.string(),
    sourceFeedId: v.id("feedSources"),
    userId: v.optional(v.string()),
  }), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("articles")
      .filter((q) => 
        q.and(
          q.eq(q.field("title"), args.title),
          q.eq(q.field("sourceFeedId"), args.sourceFeedId)
        )
      )
      .first();
  },
});

// RSS parsing and import functions
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
      const xml2js = require('xml2js');
      const response = await fetch(args.url);
      const text = await response.text();
      
      console.log(`Fetching RSS from ${args.url}`);
      
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(text);
      
      const articles: any[] = [];
      
      // Handle RSS 2.0 format
      if (result.rss && result.rss.channel && result.rss.channel[0].item) {
        const items = result.rss.channel[0].item;
        console.log(`Found ${items.length} RSS items`);
        
        for (const item of items) {
          try {
            const title = item.title?.[0] || 'Untitled';
            const description = item.description?.[0] || item['content:encoded']?.[0] || '';
            const link = item.link?.[0] || item.guid?.[0] || '';
            const pubDate = item.pubDate?.[0] || item.pubdate?.[0] || new Date().toISOString();
            
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
                title: title.trim(),
                content: cleanContent.substring(0, 2000), // Limit content length
                originalAddress: link || args.url,
                publicationDate,
              });
            }
          } catch (itemError) {
            console.error('Error parsing RSS item:', itemError);
          }
        }
      }
      // Handle Atom format
      else if (result.feed && result.feed.entry) {
        const entries = result.feed.entry;
        console.log(`Found ${entries.length} Atom entries`);
        
        for (const entry of entries) {
          try {
            const title = entry.title?.[0]?._ || entry.title?.[0] || 'Untitled';
            const content = entry.content?.[0]?._ || entry.content?.[0] || entry.summary?.[0]?._ || entry.summary?.[0] || '';
            const link = entry.link?.[0]?.$.href || entry.id?.[0] || '';
            const updated = entry.updated?.[0] || entry.published?.[0] || new Date().toISOString();
            
            // Parse publication date
            let publicationDate = Date.now();
            if (updated) {
              const parsed = new Date(updated);
              if (!isNaN(parsed.getTime())) {
                publicationDate = parsed.getTime();
              }
            }
            
            // Clean up content
            const cleanContent = content.replace(/<[^>]*>/g, '').trim();
            
            if (title && cleanContent) {
              articles.push({
                title: title.trim(),
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
    console.log(`Starting RSS import for feed: ${args.id}`);
    
    try {
      const feedSource = await ctx.runQuery(internal.feedSources.getFeedById, {
        id: args.id,
      });
      
      if (!feedSource) {
        console.error(`Feed source not found: ${args.id}`);
        return null;
      }
      
      console.log(`Processing RSS feed: ${feedSource.name} - ${feedSource.sourceAddress}`);
      
      const articles = await ctx.runAction(internal.feedSources.parseRssFeed, {
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
      
      await ctx.runMutation(internal.feedSources.updateFeedLastChecked, {
        id: args.id,
      });
      
      console.log(`Import complete for ${feedSource.name}: ${newArticlesCount} new articles, ${duplicatesCount} duplicates skipped`);
      return null;
      
    } catch (error) {
      console.error('Error in importFromRssSource:', error);
      return null;
    }
  },
});

// Schedule the internal action to run
export const triggerUpdateAllFeeds = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Schedule the update
    await ctx.scheduler.runAfter(0, internal.feedSources.updateAllFeeds, {});
    
    // Also schedule automatic cleanup of old articles (run every time feeds are updated)
    await ctx.scheduler.runAfter(1000, internal.articles.purgeOldArticles, {});
    
    return null;
  },
});

export const testRssSource = mutation({
  args: { url: v.string() },
  returns: v.object({
    success: v.boolean(),
    articleCount: v.number(),
    error: v.optional(v.string()),
    sampleTitle: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.scheduler.runAfter(0, internal.rssParser.testRssFeed, {
      url: args.url,
    });
    
    // Since we can't wait for the scheduled action, return a placeholder
    return {
      success: true,
      articleCount: 0,
      error: "Test scheduled - check console logs",
    };
  },
});