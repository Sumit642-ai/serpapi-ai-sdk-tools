import { asArray, asName, asNumber, asRecord, asString, omitUndefined } from "./shared.js";

/** One news article. */
export interface NewsResult {
  position?: number;
  title: string;
  link?: string;
  /** Publisher name, e.g. `"The Hindu"`. */
  source?: string;
  /** Human-readable date exactly as Google News shows it. */
  date?: string;
  /** Machine-readable timestamp, when present. Easier for a model to reason about. */
  isoDate?: string;
  snippet?: string;
}

/**
 * Flattens Google News results.
 *
 * Two shapes need handling. `source` arrives as an object (`{ name, icon }`)
 * rather than a string, and a grouped story puts the real articles in a nested
 * `stories` array with the outer entry acting only as a heading — so when we
 * see `stories` we use those instead.
 */
export function compactNews(data: Record<string, unknown>, maxResults: number): NewsResult[] {
  const flattened: unknown[] = [];

  for (const entry of asArray(data["news_results"])) {
    const item = asRecord(entry);
    if (item === undefined) continue;

    const stories = asArray(item["stories"]);
    if (stories.length > 0) {
      flattened.push(...stories);
    } else {
      flattened.push(item);
    }
  }

  return flattened
    .slice(0, maxResults)
    .map((entry) => {
      const item = asRecord(entry);
      if (item === undefined) return undefined;

      const title = asString(item["title"]);
      if (title === undefined) return undefined;

      return omitUndefined<NewsResult>({
        position: asNumber(item["position"]),
        title,
        link: asString(item["link"]),
        source: asName(item["source"]),
        date: asString(item["date"]),
        isoDate: asString(item["iso_date"]),
        snippet: asString(item["snippet"]),
      });
    })
    .filter((item): item is NewsResult => item !== undefined);
}
