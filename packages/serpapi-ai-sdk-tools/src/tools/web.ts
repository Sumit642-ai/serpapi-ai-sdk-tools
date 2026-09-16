import { tool } from "ai";
import { z } from "zod";

import { cleanParams, resolveOptions } from "../client.js";
import { compactWeb } from "../compact/web.js";
import type { SerpApiToolOptions } from "../types.js";
import { normaliseCountry, normaliseLanguage, runSearchTool } from "./shared.js";

export interface WebSearchOptions extends SerpApiToolOptions {
  /**
   * Which Google engine to use.
   *
   * - `"google_light"` (default) is SerpApi's stripped-down Google. It returns
   *   organic results only and is noticeably faster, which is what an agent
   *   loop wants.
   * - `"google"` is the full page, including answer boxes and knowledge panels.
   *   Slower, and this package keeps only the organic results either way, so
   *   choose it when you need Google's exact ranking.
   */
  engine?: "google_light" | "google";
}

/**
 * General web search, backed by SerpApi's Google or Google Light engine.
 *
 * The Python equivalent in `serpapi-search-tools` is `web_search`.
 */
export function webSearch(options: WebSearchOptions = {}) {
  const resolved = resolveOptions(options);
  const engine = options.engine ?? "google_light";

  return tool({
    description:
      "Search the web with Google through SerpApi. Use this for general questions, " +
      "facts, definitions, documentation, company or product background, and anything " +
      "that needs a current web page. Returns the top organic results with title, link " +
      "and snippet. Prefer a more specific tool when one fits: newsSearch for recent " +
      "articles, mapsSearch for places and businesses, shoppingSearch for product " +
      "prices, flightsSearch for flights, hotelsSearch for hotels.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("What to search for, written the way you would type it into Google."),
      country: z
        .string()
        .length(2)
        .optional()
        .describe(
          'Two-letter country code to search from, e.g. "in" for India, "us" for the ' +
            "United States. Affects which results rank highest.",
        ),
      language: z
        .string()
        .min(2)
        .max(5)
        .optional()
        .describe('Language code for the results, e.g. "en" or "hi".'),
    }),
    execute: async ({ query, country, language }, { abortSignal }) => {
      const params = cleanParams({
        q: query,
        gl: normaliseCountry(country) ?? resolved.defaults.gl,
        hl: normaliseLanguage(language) ?? resolved.defaults.hl,
        location: resolved.defaults.location,
        // google_light has no `num` parameter, so results are trimmed after the
        // response instead. The full google engine does honour it, which saves
        // transferring pages of results we would only throw away.
        num: engine === "google" ? resolved.maxResults : undefined,
      });

      return runSearchTool(engine, params, resolved, compactWeb, abortSignal);
    },
  });
}
