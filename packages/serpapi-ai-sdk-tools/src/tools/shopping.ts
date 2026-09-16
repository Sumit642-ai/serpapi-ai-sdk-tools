import { tool } from "ai";
import { z } from "zod";

import { cleanParams, resolveOptions } from "../client.js";
import { compactShopping } from "../compact/shopping.js";
import type { SerpApiToolOptions } from "../types.js";
import { normaliseCountry, normaliseLanguage, runSearchTool } from "./shared.js";

/**
 * Product prices, backed by SerpApi's Google Shopping engine.
 *
 * The Python equivalent in `serpapi-search-tools` is `shopping_search`.
 */
export function shoppingSearch(options: SerpApiToolOptions = {}) {
  const resolved = resolveOptions(options);

  return tool({
    description:
      "Find products and their prices on Google Shopping through SerpApi. Use this " +
      "whenever the question is about buying something, comparing prices, or finding " +
      "the cheapest or best-rated version of a product. Returns listings with price, " +
      "shop, rating and delivery. Each result has both a display price (with currency " +
      "symbol) and a numeric price for comparing.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('The product to search for, e.g. "wireless earbuds under 3000".'),
      country: z
        .string()
        .length(2)
        .optional()
        .describe(
          'Two-letter country code of the store front, e.g. "in", "us", "gb". This is ' +
            "what decides which shops appear and which currency their prices are in.",
        ),
      language: z
        .string()
        .min(2)
        .max(5)
        .optional()
        .describe('Language code for the listings, e.g. "en".'),
      minPrice: z.number().positive().optional().describe("Lowest price to include."),
      maxPrice: z.number().positive().optional().describe("Highest price to include."),
    }),
    execute: async ({ query, country, language, minPrice, maxPrice }, { abortSignal }) => {
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        return {
          error: `minPrice (${minPrice}) is higher than maxPrice (${maxPrice}). Swap them or drop one.`,
        };
      }

      // Note: google_shopping has no `currency` parameter. Prices follow the
      // store front, so `gl` is what decides the currency. A configured
      // `defaults.currency` is deliberately not sent here.
      const params = cleanParams({
        q: query,
        gl: normaliseCountry(country) ?? resolved.defaults.gl,
        hl: normaliseLanguage(language) ?? resolved.defaults.hl,
        location: resolved.defaults.location,
        min_price: minPrice,
        max_price: maxPrice,
      });

      return runSearchTool("google_shopping", params, resolved, compactShopping, abortSignal);
    },
  });
}
