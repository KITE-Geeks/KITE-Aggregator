import { query } from "./_generated/server";

/**
 * Simple demo user query - no authentication required
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    // Return a demo user for the public app
    return {
      _id: "demo-user" as any,
      name: "Demo User",
      email: "demo@example.com",
    };
  },
});