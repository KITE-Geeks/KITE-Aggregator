import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get all articles sorted by publication date (newest first)
 */
export const getAllArticles = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("articles"),
    _creationTime: v.number(),
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
    sourceFeedName: v.string(),
    sourceFeedId: v.id("feedSources"),
    userId: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_publication_date")
      .order("desc")
      .collect();
    
    return articles;
  },
});

/**
 * Get articles by feed
 */
export const getArticlesByFeed = query({
  args: { feedId: v.id("feedSources") },
  returns: v.array(v.object({
    _id: v.id("articles"),
    _creationTime: v.number(),
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
    sourceFeedName: v.string(),
    sourceFeedId: v.id("feedSources"),
    userId: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_feed", (q) => q.eq("sourceFeedId", args.feedId))
      .order("desc")
      .collect();
    
    return articles;
  },
});

/**
 * Delete articles by feed
 */
export const deleteArticlesByFeed = mutation({
  args: { feedId: v.id("feedSources") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_feed", (q) => q.eq("sourceFeedId", args.feedId))
      .collect();

    for (const article of articles) {
      await ctx.db.delete(article._id);
    }

    return articles.length;
  },
});

/**
 * Delete orphaned articles (articles from deleted feeds)
 */
export const deleteOrphanedArticles = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const allArticles = await ctx.db.query("articles").collect();
    const allFeeds = await ctx.db.query("feedSources").collect();
    const feedIds = new Set(allFeeds.map(feed => feed._id));
    
    let deletedCount = 0;
    for (const article of allArticles) {
      if (!feedIds.has(article.sourceFeedId)) {
        await ctx.db.delete(article._id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  },
});

/**
 * Delete articles older than 2 years
 */
export const purgeOldArticles = internalMutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    totalChecked: v.number(),
  }),
  handler: async (ctx, args) => {
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000); // 2 years in milliseconds
    
    const allArticles = await ctx.db.query("articles").collect();
    let deletedCount = 0;
    
    for (const article of allArticles) {
      if (article.publicationDate < twoYearsAgo) {
        // Also remove from any folders
        const folderArticles = await ctx.db
          .query("folderArticles")
          .withIndex("by_article", (q) => q.eq("articleId", article._id))
          .collect();
        
        for (const folderArticle of folderArticles) {
          await ctx.db.delete(folderArticle._id);
        }
        
        // Delete the article
        await ctx.db.delete(article._id);
        deletedCount++;
      }
    }
    
    return {
      deletedCount,
      totalChecked: allArticles.length,
    };
  },
});

/**
 * Get articles older than 2 years for review
 */
export const getOldArticles = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("articles"),
    _creationTime: v.number(),
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
    sourceFeedName: v.string(),
    sourceFeedId: v.id("feedSources"),
    userId: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000);
    
    const oldArticles = await ctx.db
      .query("articles")
      .withIndex("by_publication_date")
      .filter((q) => q.lt(q.field("publicationDate"), twoYearsAgo))
      .order("desc")
      .collect();
    
    return oldArticles;
  },
});

/**
 * Manual purge function that can be called from the UI
 */
export const manualPurgeOldArticles = mutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    totalChecked: v.number(),
  }),
  handler: async (ctx): Promise<{ deletedCount: number; totalChecked: number }> => {
    return await ctx.runMutation(internal.articles.purgeOldArticles, {});
  },
});