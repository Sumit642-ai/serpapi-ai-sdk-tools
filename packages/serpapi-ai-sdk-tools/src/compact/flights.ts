import { asArray, asNumber, asRecord, asString, omitUndefined } from "./shared.js";

/** One end of a journey. */
export interface FlightEndpoint {
  /** Airport code, e.g. `"DEL"`. */
  id?: string;
  name?: string;
  /** Local time at that airport, e.g. `"2026-10-03 06:10"`. */
  time?: string;
}

/** A stop between two legs. */
export interface FlightLayover {
  id?: string;
  name?: string;
  /** Minutes on the ground. */
  durationMinutes?: number;
  overnight?: boolean;
}

/** One bookable itinerary. */
export interface FlightResult {
  /** Total price in the requested currency. */
  price?: number;
  /** Where in the results this came from. Google's own picks are more relevant. */
  category: "best" | "other";
  /** Door-to-door minutes, including layovers. */
  totalDurationMinutes?: number;
  /** Every airline on the itinerary, in order. */
  airlines: string[];
  /** Flight numbers, in order, e.g. `["6E 2043"]`. */
  flightNumbers?: string[];
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  /** 0 for a non-stop flight. */
  stops: number;
  layovers?: FlightLayover[];
  travelClass?: string;
  /** Grams of CO2 for this itinerary, when Google reports it. */
  carbonEmissionsGrams?: number;
}

function toEndpoint(value: unknown): FlightEndpoint {
  const airport = asRecord(value);
  if (airport === undefined) return {};

  return omitUndefined<FlightEndpoint>({
    id: asString(airport["id"]),
    name: asString(airport["name"]),
    time: asString(airport["time"]),
  });
}

/**
 * Turns one itinerary into a flat object.
 *
 * SerpApi describes a journey as an array of legs. A model does not need every
 * leg to answer "what is the cheapest way to Goa" — it needs where you leave
 * from, where you land, how long it takes and how many stops. So the first
 * leg's departure and the last leg's arrival become the journey's endpoints,
 * and the legs themselves collapse into lists of airlines and flight numbers.
 */
function toItinerary(entry: unknown, category: "best" | "other"): FlightResult | undefined {
  const item = asRecord(entry);
  if (item === undefined) return undefined;

  const legs = asArray(item["flights"])
    .map((leg) => asRecord(leg))
    .filter((leg): leg is Record<string, unknown> => leg !== undefined);

  if (legs.length === 0) return undefined;

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  if (firstLeg === undefined || lastLeg === undefined) return undefined;

  const airlines: string[] = [];
  const flightNumbers: string[] = [];
  for (const leg of legs) {
    const airline = asString(leg["airline"]);
    // A codeshare can repeat the same carrier across legs; list it once.
    if (airline !== undefined && !airlines.includes(airline)) airlines.push(airline);

    const flightNumber = asString(leg["flight_number"]);
    if (flightNumber !== undefined) flightNumbers.push(flightNumber);
  }

  const layovers = asArray(item["layovers"])
    .map((stop) => {
      const layover = asRecord(stop);
      if (layover === undefined) return undefined;

      return omitUndefined<FlightLayover>({
        id: asString(layover["id"]),
        name: asString(layover["name"]),
        durationMinutes: asNumber(layover["duration"]),
        overnight: layover["overnight"] === true ? true : undefined,
      });
    })
    .filter((stop): stop is FlightLayover => stop !== undefined);

  const emissions = asRecord(item["carbon_emissions"]);

  return omitUndefined<FlightResult>({
    price: asNumber(item["price"]),
    category,
    totalDurationMinutes: asNumber(item["total_duration"]),
    airlines,
    flightNumbers: flightNumbers.length === 0 ? undefined : flightNumbers,
    departure: toEndpoint(firstLeg["departure_airport"]),
    arrival: toEndpoint(lastLeg["arrival_airport"]),
    // Two legs means one stop. This is what travellers actually compare on.
    stops: legs.length - 1,
    layovers: layovers.length === 0 ? undefined : layovers,
    travelClass: asString(firstLeg["travel_class"]),
    carbonEmissionsGrams: emissions === undefined ? undefined : asNumber(emissions["this_flight"]),
  });
}

/**
 * Flattens Google Flights results.
 *
 * `best_flights` holds Google's own recommendations and is read first, with
 * `other_flights` filling any remaining room. A one-way search sometimes
 * returns only `other_flights`, so both are always considered.
 */
export function compactFlights(
  data: Record<string, unknown>,
  maxResults: number,
): FlightResult[] {
  const best = asArray(data["best_flights"]).map((entry) => toItinerary(entry, "best"));
  const other = asArray(data["other_flights"]).map((entry) => toItinerary(entry, "other"));

  return [...best, ...other]
    .filter((item): item is FlightResult => item !== undefined)
    .slice(0, maxResults);
}
