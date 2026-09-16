/**
 * Shared types for every tool in this package.
 *
 * These are deliberately small and boring. The point of the package is that a
 * model gets a predictable, token-cheap object back, so the types describe the
 * *compact* shape we return — not SerpApi's raw response.
 */

/** Where every request goes. Exported so users can see it without reading code. */
export const SERPAPI_SEARCH_URL = "https://serpapi.com/search";

/**
 * The subset of `fetch` this package uses.
 *
 * We take it as an option so tests can inject a fake and never touch the
 * network. Typed as the global `fetch` so passing the real one always fits.
 */
export type FetchFunction = typeof globalThis.fetch;

/**
 * Defaults applied to every search, unless a tool call overrides them.
 *
 * `gl`/`hl` are SerpApi's country and language codes. Keeping these as options
 * rather than hard-coding them is why the India example in the README is just
 * `defaults: { gl: "in", hl: "en", currency: "INR" }`.
 */
export interface SearchDefaults {
  /** Two-letter country code, e.g. `"in"`, `"us"`. */
  gl?: string;
  /** Language code, e.g. `"en"`, `"hi"`. */
  hl?: string;
  /** City-level location string, e.g. `"Bengaluru, Karnataka, India"`. */
  location?: string;
  /** Currency code for prices, e.g. `"INR"`, `"USD"`. */
  currency?: string;
}

/** In-memory cache settings. Set `cache: false` to turn it off. */
export interface CacheOptions {
  /** How long a cached response stays fresh, in milliseconds. */
  ttlMs: number;
  /** Most entries to hold before the oldest are dropped. Default 100. */
  maxEntries?: number;
}

/** Options every tool factory accepts. */
export interface SerpApiToolOptions {
  /**
   * SerpApi key. Falls back to `process.env.SERPAPI_API_KEY`, then
   * `process.env.SERPAPI_KEY`.
   *
   * Prefer the environment variables — a key written in source tends to end up
   * in git.
   */
  apiKey?: string;
  /** Country, language, location and currency applied to every search. */
  defaults?: SearchDefaults;
  /** How many results to keep. Default 5. */
  maxResults?: number;
  /** Request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /** In-memory response cache, to avoid spending search credits twice. */
  cache?: CacheOptions | false;
  /** Injectable `fetch`, mainly for tests. Defaults to the global `fetch`. */
  fetch?: FetchFunction;
}

/**
 * What a tool returns when something goes wrong.
 *
 * We return this instead of throwing so the model can read the message and try
 * something else (fix a date, drop a filter) rather than the whole run failing.
 * The API key is never part of the message.
 */
export interface ToolError {
  error: string;
}

/**
 * What a tool returns when it worked.
 *
 * `engine` and `params` make SerpApi usage visible in the demo UI and in logs.
 * `params` never contains the API key.
 */
export interface ToolSuccess<T> {
  engine: string;
  params: Record<string, string>;
  results: T[];
  /** Present only when `results` is empty. */
  note?: string;
}

/** Every tool resolves to one of these two shapes. */
export type ToolResult<T> = ToolSuccess<T> | ToolError;
