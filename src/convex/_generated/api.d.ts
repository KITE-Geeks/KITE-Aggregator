/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as articles from "../articles.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as auth from "../auth.js";
import type * as customFolders from "../customFolders.js";
import type * as feedSources from "../feedSources.js";
import type * as htmlParser from "../htmlParser.js";
import type * as http from "../http.js";
import type * as rssParser from "../rssParser.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  articles: typeof articles;
  "auth/emailOtp": typeof auth_emailOtp;
  auth: typeof auth;
  customFolders: typeof customFolders;
  feedSources: typeof feedSources;
  htmlParser: typeof htmlParser;
  http: typeof http;
  rssParser: typeof rssParser;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
