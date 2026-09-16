import {
  asArray,
  asNumber,
  asRecord,
  asString,
  asStringList,
  omitUndefined,
} from "./shared.js";

/** How many amenities to keep. Enough to be useful, short enough to stay cheap. */
const MAX_AMENITIES = 6;

/** One hotel or vacation rental. */
export interface HotelResult {
  name: string;
  /** `"hotel"` or `"vacation rental"`. */
  type?: string;
  /** Nightly price as shown, e.g. `"₹4,200"`. */
  ratePerNight?: string;
  /** Nightly price as a number, for comparing. */
  extractedRatePerNight?: number;
  /** Price for the whole stay, as shown. */
  totalRate?: string;
  /** Guest rating out of 5. */
  overallRating?: number;
  reviews?: number;
  /** Star rating, e.g. 4 for a 4-star hotel. */
  hotelClass?: number;
  amenities?: string[];
  link?: string;
  checkInTime?: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  /** First photo. Kept so the demo can render a real hotel card. */
  thumbnail?: string;
}

/**
 * Flattens Google Hotels results.
 *
 * Only the first image is kept out of the `images` array, and amenities are
 * capped — a single property can list thirty of them, which would dwarf every
 * other field in the response for no real benefit.
 */
export function compactHotels(data: Record<string, unknown>, maxResults: number): HotelResult[] {
  return asArray(data["properties"])
    .slice(0, maxResults)
    .map((entry) => {
      const item = asRecord(entry);
      if (item === undefined) return undefined;

      const name = asString(item["name"]);
      if (name === undefined) return undefined;

      const ratePerNight = asRecord(item["rate_per_night"]);
      const totalRate = asRecord(item["total_rate"]);
      const coordinates = asRecord(item["gps_coordinates"]);

      const firstImage = asRecord(asArray(item["images"])[0]);
      const thumbnail =
        firstImage === undefined
          ? undefined
          : asString(firstImage["thumbnail"]) ?? asString(firstImage["original_image"]);

      return omitUndefined<HotelResult>({
        name,
        type: asString(item["type"]),
        ratePerNight: ratePerNight === undefined ? undefined : asString(ratePerNight["lowest"]),
        extractedRatePerNight:
          ratePerNight === undefined ? undefined : asNumber(ratePerNight["extracted_lowest"]),
        totalRate: totalRate === undefined ? undefined : asString(totalRate["lowest"]),
        overallRating: asNumber(item["overall_rating"]),
        reviews: asNumber(item["reviews"]),
        hotelClass: asNumber(item["extracted_hotel_class"]),
        amenities: asStringList(item["amenities"], MAX_AMENITIES),
        link: asString(item["link"]),
        checkInTime: asString(item["check_in_time"]),
        checkOutTime: asString(item["check_out_time"]),
        latitude: coordinates === undefined ? undefined : asNumber(coordinates["latitude"]),
        longitude: coordinates === undefined ? undefined : asNumber(coordinates["longitude"]),
        thumbnail,
      });
    })
    .filter((item): item is HotelResult => item !== undefined);
}
