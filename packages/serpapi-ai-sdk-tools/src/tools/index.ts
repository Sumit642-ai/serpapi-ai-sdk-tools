import type { SerpApiToolOptions } from "../types.js";
import { flightsSearch } from "./flights.js";
import { hotelsSearch } from "./hotels.js";
import { mapsSearch } from "./maps.js";
import { newsSearch } from "./news.js";
import { shoppingSearch } from "./shopping.js";
import { webSearch, type WebSearchOptions } from "./web.js";

/** Short names used by the `include` option. */
export type SerpApiToolName = "web" | "news" | "maps" | "shopping" | "flights" | "hotels";

/**
 * Maps a short name to the name the model sees.
 *
 * The tool names deliberately echo SerpApi's Python package — `webSearch` here
 * is `web_search` there — so anyone moving between the two recognises them.
 */
const TOOL_KEYS = {
  web: "webSearch",
  news: "newsSearch",
  maps: "mapsSearch",
  shopping: "shoppingSearch",
  flights: "flightsSearch",
  hotels: "hotelsSearch",
} as const satisfies Record<SerpApiToolName, string>;

/** Every tool this package provides, keyed by the name the model sees. */
export interface AllSerpApiTools {
  webSearch: ReturnType<typeof webSearch>;
  newsSearch: ReturnType<typeof newsSearch>;
  mapsSearch: ReturnType<typeof mapsSearch>;
  shoppingSearch: ReturnType<typeof shoppingSearch>;
  flightsSearch: ReturnType<typeof flightsSearch>;
  hotelsSearch: ReturnType<typeof hotelsSearch>;
}

export interface SerpApiToolsOptions<Name extends SerpApiToolName = SerpApiToolName>
  extends WebSearchOptions {
  /**
   * Which tools to return. Defaults to all six.
   *
   * Handing a model six tools when it only needs two costs tokens on every
   * single request and gives it more ways to pick the wrong one, so narrow this
   * when you know the job.
   */
  include?: readonly Name[];
}

/**
 * Creates the SerpApi tools in one call.
 *
 * ```ts
 * const tools = serpApiTools({ defaults: { gl: "in", hl: "en", currency: "INR" } });
 * ```
 *
 * Every option is shared by all the tools it creates. To configure one tool
 * differently, build that one with its own factory instead.
 *
 * The return type narrows to exactly what `include` asked for, so
 * `serpApiTools({ include: ["flights"] })` gives you an object with only
 * `flightsSearch` on it — no casting needed.
 */
export function serpApiTools<const Name extends SerpApiToolName = SerpApiToolName>(
  options: SerpApiToolsOptions<Name> = {},
): Pick<AllSerpApiTools, (typeof TOOL_KEYS)[Name]> {
  const { include, ...shared } = options;
  const wanted: readonly SerpApiToolName[] =
    include ?? (Object.keys(TOOL_KEYS) as SerpApiToolName[]);

  // Only the requested tools are constructed. Each factory resolves the API key
  // and builds a cache when created, so skipping the rest is worth doing.
  const built: Partial<AllSerpApiTools> = {};

  for (const name of wanted) {
    switch (name) {
      case "web":
        built.webSearch = webSearch(shared);
        break;
      case "news":
        built.newsSearch = newsSearch(shared);
        break;
      case "maps":
        built.mapsSearch = mapsSearch(shared);
        break;
      case "shopping":
        built.shoppingSearch = shoppingSearch(shared);
        break;
      case "flights":
        built.flightsSearch = flightsSearch(shared);
        break;
      case "hotels":
        built.hotelsSearch = hotelsSearch(shared);
        break;
    }
  }

  return built as Pick<AllSerpApiTools, (typeof TOOL_KEYS)[Name]>;
}

export { flightsSearch, hotelsSearch, mapsSearch, newsSearch, shoppingSearch, webSearch };
export type { WebSearchOptions };
export type { SerpApiToolOptions };
