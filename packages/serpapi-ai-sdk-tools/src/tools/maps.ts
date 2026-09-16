import { tool } from "ai";
import { z } from "zod";

import { cleanParams, resolveOptions } from "../client.js";
import { compactMaps } from "../compact/maps.js";
import type { SerpApiToolOptions } from "../types.js";
import { normaliseCountry, normaliseLanguage, runSearchTool } from "./shared.js";

/** Google's default zoom when none is given. Roughly neighbourhood level. */
const DEFAULT_ZOOM = 14;

/**
 * Places and businesses, backed by SerpApi's Google Maps engine.
 *
 * The Python equivalent in `serpapi-search-tools` is `maps_search`.
 */
export function mapsSearch(options: SerpApiToolOptions = {}) {
  const resolved = resolveOptions(options);

  return tool({
    description:
      "Find places, businesses and points of interest on Google Maps through SerpApi. " +
      "Use this for restaurants, cafes, shops, hospitals, landmarks or any 'near me' / " +
      "'in <area>' question. Returns names with address, rating, review count, price " +
      "band, phone and opening state. Include the area in the query, for example " +
      '"cafes near Connaught Place, New Delhi".',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          'What to look for, including the area if you know it, e.g. "vegetarian ' +
            'restaurants in Bandra, Mumbai".',
        ),
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .optional()
        .describe("Latitude to search around. Send together with longitude."),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .optional()
        .describe("Longitude to search around. Send together with latitude."),
      country: z
        .string()
        .length(2)
        .optional()
        .describe('Two-letter country code, e.g. "in".'),
      language: z
        .string()
        .min(2)
        .max(5)
        .optional()
        .describe('Language code for the results, e.g. "en".'),
    }),
    execute: async ({ query, latitude, longitude, country, language }, { abortSignal }) => {
      // Coordinates only mean something as a pair, so require both before using
      // either. A lone latitude is almost certainly a model slip.
      const hasCoordinates = latitude !== undefined && longitude !== undefined;

      // Google Maps wants its coordinates in this exact shape: an @ sign, the
      // pair, then a zoom level suffixed with "z".
      const ll = hasCoordinates ? `@${latitude},${longitude},${DEFAULT_ZOOM}z` : undefined;

      // The google_maps engine has no `location` parameter, unlike the web
      // engines. A configured default location is folded into the query text
      // instead, which is how a person would search anyway.
      const defaultLocation = resolved.defaults.location;
      const shouldAppendLocation =
        !hasCoordinates &&
        defaultLocation !== undefined &&
        !query.toLowerCase().includes(defaultLocation.toLowerCase());

      const params = cleanParams({
        q: shouldAppendLocation ? `${query} ${defaultLocation}` : query,
        ll,
        // Required by SerpApi whenever the search is driven by a query string.
        type: "search",
        gl: normaliseCountry(country) ?? resolved.defaults.gl,
        hl: normaliseLanguage(language) ?? resolved.defaults.hl,
      });

      return runSearchTool("google_maps", params, resolved, compactMaps, abortSignal);
    },
  });
}
