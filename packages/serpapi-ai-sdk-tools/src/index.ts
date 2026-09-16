/**
 * serpapi-ai-sdk-tools — SerpApi search tools for the Vercel AI SDK.
 *
 * Not an official SerpApi package.
 *
 * The six tool factories land here in Phase 3. For now this exports the shared
 * types and the SerpApi endpoint, both of which the tools build on.
 */

export { SERPAPI_SEARCH_URL } from "./types.js";

export type {
  CacheOptions,
  FetchFunction,
  SearchDefaults,
  SerpApiToolOptions,
  ToolError,
  ToolResult,
  ToolSuccess,
} from "./types.js";
