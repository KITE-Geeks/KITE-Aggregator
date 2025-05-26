import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema(
  {
    // External Feed Sources (RSS and HTML)
    feedSources: defineTable({
      name: v.string(),
      sourceAddress: v.string(),
      sourceType: v.union(v.literal("rss"), v.literal("html")), // New field to distinguish source types
      lastChecked: v.optional(v.number()),
      isActive: v.boolean(),
      userId: v.optional(v.string()), // Changed to optional string for demo mode
      // HTML parsing configuration
      htmlConfig: v.optional(v.object({
        articleSelector: v.optional(v.string()), // CSS selector for article containers
        titleSelector: v.optional(v.string()), // CSS selector for article titles
        contentSelector: v.optional(v.string()), // CSS selector for article content
        linkSelector: v.optional(v.string()), // CSS selector for article links
        dateSelector: v.optional(v.string()), // CSS selector for publication dates
      })),
    })
      .index("by_active", ["isActive"])
      .index("by_type", ["sourceType"]),

    // Articles from external feeds
    articles: defineTable({
      title: v.string(),
      content: v.string(),
      originalAddress: v.string(),
      publicationDate: v.number(),
      sourceFeedName: v.string(),
      sourceFeedId: v.id("feedSources"),
      userId: v.optional(v.string()), // Changed to optional string for demo mode
    })
      .index("by_feed", ["sourceFeedId"])
      .index("by_publication_date", ["publicationDate"]),

    // Custom Folders for organization
    customFolders: defineTable({
      name: v.string(),
      userId: v.optional(v.string()), // Changed to optional string for demo mode
      dateCreated: v.number(),
    }),

    // Junction table for articles in custom folders
    folderArticles: defineTable({
      folderId: v.id("customFolders"),
      articleId: v.id("articles"),
      userId: v.optional(v.string()), // Changed to optional string for demo mode
      dateAdded: v.number(),
    })
      .index("by_folder", ["folderId"])
      .index("by_article", ["articleId"]),
  },
  {
    schemaValidation: false,
  }
);

export default schema;