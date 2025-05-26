import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Demo user ID - in a real app, this would come from authentication
const DEMO_USER_ID = "demo-user";

// Create a new custom folder
export const createCustomFolder = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("customFolders"),
  handler: async (ctx, args) => {
    // Use a default user ID for demo purposes
    return await ctx.db.insert("customFolders", {
      name: args.name,
      userId: DEMO_USER_ID,
      dateCreated: Date.now(),
    });
  },
});

// Rename a custom folder
export const renameCustomFolder = mutation({
  args: {
    id: v.id("customFolders"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
    return null;
  },
});

// Remove a custom folder
export const removeCustomFolder = mutation({
  args: {
    id: v.id("customFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // First, remove all articles from this folder
    const folderArticles = await ctx.db
      .query("folderArticles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();
    
    for (const folderArticle of folderArticles) {
      await ctx.db.delete(folderArticle._id);
    }
    
    // Then delete the folder
    await ctx.db.delete(args.id);
    return null;
  },
});

// Get all custom folders
export const getCustomFolders = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("customFolders"),
    _creationTime: v.number(),
    name: v.string(),
    userId: v.optional(v.string()), // Changed from v.optional(v.string()) to v.optional(v.string())
    dateCreated: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("customFolders").collect();
  },
});

// Add a marked article to a custom folder
export const addArticleToFolder = mutation({
  args: {
    folderId: v.id("customFolders"),
    articleId: v.id("articles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if article is already in folder
    const existing = await ctx.db
      .query("folderArticles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .filter((q) => q.eq(q.field("articleId"), args.articleId))
      .first();
    
    if (!existing) {
      await ctx.db.insert("folderArticles", {
        folderId: args.folderId,
        articleId: args.articleId,
        userId: DEMO_USER_ID,
        dateAdded: Date.now(),
      });
    }
    return null;
  },
});

// Remove a marked article from a custom folder
export const removeArticleFromFolder = mutation({
  args: {
    folderId: v.id("customFolders"),
    articleId: v.id("articles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const folderArticle = await ctx.db
      .query("folderArticles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .filter((q) => q.eq(q.field("articleId"), args.articleId))
      .first();
    
    if (folderArticle) {
      await ctx.db.delete(folderArticle._id);
    }
    return null;
  },
});

// Get articles within a specific custom folder
export const getArticlesInFolder = query({
  args: { folderId: v.id("customFolders") },
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
    dateAdded: v.number(),
  })),
  handler: async (ctx, args) => {
    const folderArticles = await ctx.db
      .query("folderArticles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    const articles = [];
    for (const folderArticle of folderArticles) {
      const article = await ctx.db.get(folderArticle.articleId);
      if (article) {
        articles.push({
          ...article,
          dateAdded: folderArticle.dateAdded,
        });
      }
    }

    return articles.sort((a, b) => b.dateAdded - a.dateAdded);
  },
});

// Get articles within a specific custom folder
export const getFolderArticles = query({
  args: { folderId: v.id("customFolders") },
  returns: v.array(v.object({
    _id: v.id("articles"),
    _creationTime: v.number(),
    title: v.string(),
    content: v.string(),
    originalAddress: v.string(),
    publicationDate: v.number(),
    sourceFeedName: v.string(),
    sourceFeedId: v.id("feedSources"),
    userId: v.optional(v.string()), // Fixed: changed from v.optional(v.string()) to v.optional(v.string())
    dateAdded: v.number(),
  })),
  handler: async (ctx, args) => {
    const folderArticles = await ctx.db
      .query("folderArticles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    const articles = [];
    for (const folderArticle of folderArticles) {
      const article = await ctx.db.get(folderArticle.articleId);
      if (article) {
        articles.push({
          ...article,
          dateAdded: folderArticle.dateAdded,
        });
      }
    }

    return articles;
  },
});

export const getMarkedArticles = query({
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
    dateAdded: v.number(),
  })),
  handler: async (ctx, args) => {
    // Since we removed marked status, return articles that are in any folder
    const folderArticles = await ctx.db
      .query("folderArticles")
      .collect();

    const articles = [];
    for (const folderArticle of folderArticles) {
      const article = await ctx.db.get(folderArticle.articleId);
      if (article) {
        articles.push({
          ...article,
          dateAdded: folderArticle.dateAdded,
        });
      }
    }

    // Remove duplicates and sort by date added
    const uniqueArticles = articles.filter((article, index, self) => 
      index === self.findIndex(a => a._id === article._id)
    );

    return uniqueArticles.sort((a, b) => b.dateAdded - a.dateAdded);
  },
});