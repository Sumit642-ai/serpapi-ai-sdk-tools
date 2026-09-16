import { search, type ResolvedOptions } from "../client.js";
import type { ToolResult } from "../types.js";

/**
 * Runs one search and shrinks the response.
 *
 * Every tool ends with this call, so the success shape, the empty-result note
 * and the error shape are identical across all six. `params` is echoed back to
 * the caller exactly as it was sent — it never contains the API key, because
 * the key is only ever attached to the URL inside `search`.
 */
export async function runSearchTool<T>(
  engine: string,
  params: Record<string, string>,
  options: ResolvedOptions,
  compact: (data: Record<string, unknown>, maxResults: number) => T[],
  abortSignal?: AbortSignal,
): Promise<ToolResult<T>> {
  const outcome = await search(engine, params, options, abortSignal);

  if (!outcome.ok) {
    return { error: outcome.error };
  }

  const results = compact(outcome.data, options.maxResults);

  // An empty list is a normal answer, not a failure. Saying so plainly stops a
  // model from retrying the same search over and over.
  if (results.length === 0) {
    return { engine, params, results: [], note: "No results found" };
  }

  return { engine, params, results };
}

/** SerpApi expects lowercase country codes (`in`), models often send `IN`. */
export function normaliseCountry(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim().toLowerCase();
}

/** Language codes are lowercase too (`en`, `hi`, `pt-br`). */
export function normaliseLanguage(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim().toLowerCase();
}
