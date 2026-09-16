import { tool } from "ai";
import { z } from "zod";

import { cleanParams, resolveOptions } from "../client.js";
import { compactNews } from "../compact/news.js";
import type { SerpApiToolOptions } from "../types.js";
import { normaliseCountry, normaliseLanguage, runSearchTool } from "./shared.js";

/**
 * Recent news, backed by SerpApi's Google News engine.
 *
 * The Python equivalent in `serpapi-search-tools` is `news_search`.
 */
export function newsSearch(options: SerpApiToolOptions = {}) {
  const resolved = resolveOptions(options);

  return tool({
    description:
      "Search Google News through SerpApi for recent news articles. Use this when the " +
      "question is about something that happened recently, or asks for the latest on a " +
      "topic, company, person or event. Returns headlines with publisher, publication " +
      "date and link. Use webSearch instead for background that is not time-sensitive.",
    inputSchema: z.object({
      query: z.string().min(1).describe("The topic, person, company or event to find news about."),
      country: z
        .string()
        .length(2)
        .optional()
        .describe('Two-letter country code to slant coverage to, e.g. "in", "us", "gb".'),
      language: z
        .string()
        .min(2)
        .max(5)
        .optional()
        .describe('Language code for the articles, e.g. "en" or "hi".'),
    }),
    execute: async ({ query, country, language }, { abortSignal }) => {
      const params = cleanParams({
        q: query,
        gl: normaliseCountry(country) ?? resolved.defaults.gl,
        hl: normaliseLanguage(language) ?? resolved.defaults.hl,
      });

      return runSearchTool("google_news", params, resolved, compactNews, abortSignal);
    },
  });
}
