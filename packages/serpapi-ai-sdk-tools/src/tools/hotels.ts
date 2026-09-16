import { tool } from "ai";
import { z } from "zod";

import { cleanParams, resolveOptions } from "../client.js";
import { compactHotels } from "../compact/hotels.js";
import type { SerpApiToolOptions } from "../types.js";
import { checkDate, isBefore, isValidIsoDate } from "../validate.js";
import { normaliseCountry, normaliseLanguage, runSearchTool } from "./shared.js";

/**
 * Hotels and vacation rentals, backed by SerpApi's Google Hotels engine.
 *
 * The Python equivalent in `serpapi-search-tools` is `hotels_search`.
 */
export function hotelsSearch(options: SerpApiToolOptions = {}) {
  const resolved = resolveOptions(options);

  return tool({
    description:
      "Search hotels and vacation rentals on Google Hotels through SerpApi. Both dates " +
      "are required and must be YYYY-MM-DD, with check-out after check-in; work out the " +
      "real dates before calling, rather than sending words like 'this weekend'. " +
      "Returns properties with nightly rate, total rate, guest rating, star class and " +
      "amenities.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('Where to stay, e.g. "hotels in Lisbon" or "beach resorts near Da Nang".'),
      checkInDate: z
        .string()
        .describe('Check-in date as YYYY-MM-DD, e.g. "2026-10-03". Must not be in the past.'),
      checkOutDate: z
        .string()
        .describe('Check-out date as YYYY-MM-DD. Must be after the check-in date.'),
      adults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Number of adult guests. Defaults to 2."),
      currency: z
        .string()
        .length(3)
        .optional()
        .describe('Three-letter currency code for the prices, e.g. "INR" or "USD".'),
      country: z
        .string()
        .length(2)
        .optional()
        .describe('Two-letter country code, e.g. "in".'),
    }),
    execute: async (input, { abortSignal }) => {
      const checkInProblem = checkDate("checkInDate", input.checkInDate);
      if (checkInProblem !== undefined) {
        return { error: checkInProblem };
      }

      if (!isValidIsoDate(input.checkOutDate)) {
        return {
          error: `checkOutDate must be a real date in YYYY-MM-DD format. Received "${input.checkOutDate}".`,
        };
      }

      // Google Hotels needs at least one night; equal dates return nothing useful.
      if (!isBefore(input.checkInDate, input.checkOutDate)) {
        return {
          error:
            `checkOutDate (${input.checkOutDate}) must be after checkInDate ` +
            `(${input.checkInDate}). A stay needs at least one night.`,
        };
      }

      const params = cleanParams({
        q: input.query,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        adults: input.adults,
        currency: input.currency?.toUpperCase() ?? resolved.defaults.currency,
        gl: normaliseCountry(input.country) ?? resolved.defaults.gl,
        hl: normaliseLanguage(resolved.defaults.hl),
      });

      return runSearchTool("google_hotels", params, resolved, compactHotels, abortSignal);
    },
  });
}
