import { asArray, asNumber, asRecord, asString, omitUndefined } from "./shared.js";

/** One place on the map. */
export interface MapsResult {
  position?: number;
  title: string;
  address?: string;
  /** Category, e.g. `"Coffee shop"`. */
  type?: string;
  rating?: number;
  /** How many reviews the rating is based on. */
  reviews?: number;
  /** Price band as Google shows it, e.g. `"₹200–400"`. */
  price?: string;
  phone?: string;
  website?: string;
  /** e.g. `"Open ⋅ Closes 11 pm"`. */
  openState?: string;
  latitude?: number;
  longitude?: number;
}

function toPlace(entry: unknown): MapsResult | undefined {
  const item = asRecord(entry);
  if (item === undefined) return undefined;

  const title = asString(item["title"]);
  if (title === undefined) return undefined;

  const coordinates = asRecord(item["gps_coordinates"]);

  return omitUndefined<MapsResult>({
    position: asNumber(item["position"]),
    title,
    address: asString(item["address"]),
    type: asString(item["type"]),
    rating: asNumber(item["rating"]),
    reviews: asNumber(item["reviews"]),
    price: asString(item["price"]),
    phone: asString(item["phone"]),
    website: asString(item["website"]),
    openState: asString(item["open_state"]),
    latitude: coordinates === undefined ? undefined : asNumber(coordinates["latitude"]),
    longitude: coordinates === undefined ? undefined : asNumber(coordinates["longitude"]),
  });
}

/**
 * Flattens Google Maps results.
 *
 * Google answers a broad query ("cafes near me") with a `local_results` list,
 * but a query that pinpoints one business ("Monmouth Coffee, Borough Market")
 * returns a single `place_results` object instead. Both are handled so the tool
 * always returns a list.
 *
 * Opening hours are dropped — they are a large nested structure and `openState`
 * already answers the question a user actually asks.
 */
export function compactMaps(data: Record<string, unknown>, maxResults: number): MapsResult[] {
  const local = asArray(data["local_results"]);

  if (local.length === 0) {
    const single = toPlace(data["place_results"]);
    return single === undefined ? [] : [single];
  }

  return local
    .slice(0, maxResults)
    .map(toPlace)
    .filter((item): item is MapsResult => item !== undefined);
}
