import { asArray, asNumber, asRecord, asString, omitUndefined } from "./shared.js";

/** One web search result. */
export interface WebResult {
  position?: number;
  title: string;
  link?: string;
  snippet?: string;
  /** The readable domain line, e.g. `"serpapi.com › search-api"`. */
  source?: string;
  /** Publication date, when Google shows one. */
  date?: string;
}

/**
 * Keeps the organic results and drops everything else.
 *
 * A raw Google response is tens of kilobytes of pagination tokens, thumbnails
 * and sitelinks. A model answering "what is X" needs the title, the link and
 * the snippet, so that is all we keep.
 */
export function compactWeb(data: Record<string, unknown>, maxResults: number): WebResult[] {
  return asArray(data["organic_results"])
    .slice(0, maxResults)
    .map((entry) => {
      const item = asRecord(entry);
      if (item === undefined) return undefined;

      const title = asString(item["title"]);
      if (title === undefined) return undefined;

      return omitUndefined<WebResult>({
        position: asNumber(item["position"]),
        title,
        link: asString(item["link"]),
        snippet: asString(item["snippet"]),
        source: asString(item["displayed_link"]) ?? asString(item["source"]),
        date: asString(item["date"]),
      });
    })
    .filter((item): item is WebResult => item !== undefined);
}
