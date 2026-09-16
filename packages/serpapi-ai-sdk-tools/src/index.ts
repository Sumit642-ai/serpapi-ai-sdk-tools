/**
 * serpapi-ai-sdk-tools — SerpApi search tools for the Vercel AI SDK.
 *
 * Six ready-made tools — web, news, maps, shopping, flights and hotels — that
 * plug straight into `generateText` or `streamText`.
 *
 * This is NOT an official SerpApi package. It is a community, open-source
 * project, and the TypeScript counterpart of SerpApi's Python package
 * `serpapi-search-tools`.
 */

// --- The tools ---
export {
  serpApiTools,
  webSearch,
  newsSearch,
  mapsSearch,
  shoppingSearch,
  flightsSearch,
  hotelsSearch,
} from "./tools/index.js";

export type {
  AllSerpApiTools,
  SerpApiToolName,
  SerpApiToolsOptions,
  WebSearchOptions,
} from "./tools/index.js";

// --- Shared options and result envelopes ---
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

// --- The shape of each tool's results ---
// Exported so applications can type their own rendering code against them.
export type { WebResult } from "./compact/web.js";
export type { NewsResult } from "./compact/news.js";
export type { MapsResult } from "./compact/maps.js";
export type { ShoppingResult } from "./compact/shopping.js";
export type { FlightEndpoint, FlightLayover, FlightResult } from "./compact/flights.js";
export type { HotelResult } from "./compact/hotels.js";
