import { tool } from "ai";
import { z } from "zod";

import { cleanParams, resolveOptions } from "../client.js";
import { compactFlights } from "../compact/flights.js";
import type { SerpApiToolOptions } from "../types.js";
import { IATA_PATTERN, checkDate, isValidIsoDate } from "../validate.js";
import { normaliseCountry, normaliseLanguage, runSearchTool } from "./shared.js";

/** SerpApi encodes trip type as a number. */
const TRIP_ROUND_TRIP = 1;
const TRIP_ONE_WAY = 2;

/** SerpApi encodes cabin class as a number too. */
const TRAVEL_CLASS_CODES = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
} as const;

/**
 * Flight prices and itineraries, backed by SerpApi's Google Flights engine.
 *
 * The Python equivalent in `serpapi-search-tools` is `flights_search`.
 */
export function flightsSearch(options: SerpApiToolOptions = {}) {
  const resolved = resolveOptions(options);

  return tool({
    description:
      "Search real flights and prices on Google Flights through SerpApi. Airports must " +
      "be 3-letter IATA codes — DEL for Delhi, BOM for Mumbai, GOI for Goa, BLR for " +
      "Bengaluru, MAA for Chennai. Dates must be YYYY-MM-DD and cannot be in the past; " +
      "work out the real date before calling, rather than sending words like 'next " +
      "Friday'. Leave returnDate empty for a one-way trip. Returns itineraries with " +
      "price, total duration, airlines and number of stops.",
    inputSchema: z.object({
      departureId: z
        .string()
        .regex(IATA_PATTERN, "Use a 3-letter IATA airport code, for example DEL.")
        .describe('Departure airport as a 3-letter IATA code, e.g. "DEL".'),
      arrivalId: z
        .string()
        .regex(IATA_PATTERN, "Use a 3-letter IATA airport code, for example GOI.")
        .describe('Destination airport as a 3-letter IATA code, e.g. "GOI".'),
      outboundDate: z
        .string()
        .describe('Departure date as YYYY-MM-DD, e.g. "2026-10-03". Must not be in the past.'),
      returnDate: z
        .string()
        .optional()
        .describe(
          "Return date as YYYY-MM-DD, after the outbound date. Leave this out entirely " +
            "for a one-way trip.",
        ),
      adults: z
        .number()
        .int()
        .min(1)
        .max(9)
        .optional()
        .describe("Number of adult passengers. Defaults to 1."),
      travelClass: z
        .enum(["economy", "premium_economy", "business", "first"])
        .optional()
        .describe("Cabin class. Defaults to economy."),
      currency: z
        .string()
        .length(3)
        .optional()
        .describe('Three-letter currency code for the prices, e.g. "INR" or "USD".'),
    }),
    execute: async (input, { abortSignal }) => {
      const departureId = input.departureId.toUpperCase();
      const arrivalId = input.arrivalId.toUpperCase();

      // Every check below runs before the request, so a mistake costs no credits
      // and the model gets a sentence telling it precisely what to change.
      if (departureId === arrivalId) {
        return {
          error: `departureId and arrivalId are both ${departureId}. Give two different airports.`,
        };
      }

      const outboundProblem = checkDate("outboundDate", input.outboundDate);
      if (outboundProblem !== undefined) {
        return { error: outboundProblem };
      }

      if (input.returnDate !== undefined) {
        if (!isValidIsoDate(input.returnDate)) {
          return {
            error: `returnDate must be a real date in YYYY-MM-DD format. Received "${input.returnDate}".`,
          };
        }
        if (input.returnDate <= input.outboundDate) {
          return {
            error:
              `returnDate (${input.returnDate}) must be after outboundDate ` +
              `(${input.outboundDate}). For a one-way trip, leave returnDate out.`,
          };
        }
      }

      // Google Flights rejects a round-trip search with no return date, and
      // equally rejects a one-way search that has one. Deriving the type from
      // whether a return date was given makes that impossible to get wrong.
      const isRoundTrip = input.returnDate !== undefined;

      const params = cleanParams({
        departure_id: departureId,
        arrival_id: arrivalId,
        outbound_date: input.outboundDate,
        return_date: input.returnDate,
        type: isRoundTrip ? TRIP_ROUND_TRIP : TRIP_ONE_WAY,
        adults: input.adults,
        travel_class:
          input.travelClass === undefined ? undefined : TRAVEL_CLASS_CODES[input.travelClass],
        currency: input.currency?.toUpperCase() ?? resolved.defaults.currency,
        gl: normaliseCountry(resolved.defaults.gl),
        hl: normaliseLanguage(resolved.defaults.hl),
      });

      return runSearchTool("google_flights", params, resolved, compactFlights, abortSignal);
    },
  });
}
