import { asArray, asName, asNumber, asRecord, asString, omitUndefined } from "./shared.js";

/** One product listing. */
export interface ShoppingResult {
  position?: number;
  title: string;
  /** Price exactly as shown, including the currency symbol, e.g. `"₹2,499"`. */
  price?: string;
  /** The same price as a number, for comparing and sorting. */
  extractedPrice?: number;
  link?: string;
  /** The shop, e.g. `"Amazon.in"`. */
  source?: string;
  rating?: number;
  reviews?: number;
  /** e.g. `"Free delivery by Tue, 23 Sep"`. */
  delivery?: string;
  snippet?: string;
  /** Product image. Kept so the demo can render a real product card. */
  thumbnail?: string;
}

/**
 * Flattens Google Shopping results.
 *
 * Both the price string and the numeric price are kept. The string is what a
 * person should be shown ("₹2,499" carries the currency); the number is what a
 * model needs to answer "which is cheapest" without parsing text.
 */
export function compactShopping(
  data: Record<string, unknown>,
  maxResults: number,
): ShoppingResult[] {
  const listings = asArray(data["shopping_results"]);
  const source = listings.length > 0 ? listings : asArray(data["inline_shopping_results"]);

  return source
    .slice(0, maxResults)
    .map((entry) => {
      const item = asRecord(entry);
      if (item === undefined) return undefined;

      const title = asString(item["title"]);
      if (title === undefined) return undefined;

      return omitUndefined<ShoppingResult>({
        position: asNumber(item["position"]),
        title,
        price: asString(item["price"]),
        extractedPrice: asNumber(item["extracted_price"]),
        link: asString(item["product_link"]) ?? asString(item["link"]),
        source: asName(item["source"]),
        rating: asNumber(item["rating"]),
        reviews: asNumber(item["reviews"]),
        delivery: asString(item["delivery"]),
        snippet: asString(item["snippet"]),
        thumbnail: asString(item["thumbnail"]),
      });
    })
    .filter((item): item is ShoppingResult => item !== undefined);
}
