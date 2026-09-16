import { SearchCache, buildCacheKey } from "./cache.js";
import {
  SERPAPI_SEARCH_URL,
  type FetchFunction,
  type SearchDefaults,
  type SerpApiToolOptions,
} from "./types.js";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESULTS = 5;

/** Shown when no key is configured. Tells the model *and* the developer what to do. */
const MISSING_KEY_MESSAGE =
  "No SerpApi key was found. Set the SERPAPI_API_KEY environment variable " +
  "(SERPAPI_KEY also works), or pass `apiKey` when creating the tool. " +
  "A free key is available at https://serpapi.com/manage-api-key";

/**
 * SerpApi answers with HTTP 200 and an `error` string when a perfectly valid
 * search simply matched nothing. That is an empty result, not a failure, so we
 * detect those messages and report zero results instead of an error.
 */
const NO_RESULTS_PATTERN = /hasn't returned any results|no results found|didn't return any results/i;

/** Options after defaults have been filled in. */
export interface ResolvedOptions {
  apiKey: string | undefined;
  defaults: SearchDefaults;
  maxResults: number;
  timeoutMs: number;
  cache: SearchCache | null;
  fetch: FetchFunction | undefined;
}

export type SearchOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Reads an environment variable, treating blank values as absent.
 *
 * `process` is checked defensively because this package can be bundled for
 * runtimes that do not define it.
 */
function readEnv(name: string): string | undefined {
  if (typeof process === "undefined" || process.env === undefined) return undefined;

  const value = process.env[name];
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Finds the API key: explicit option first, then the two supported environment
 * variable names. `SERPAPI_KEY` is accepted because some SerpApi examples use it.
 */
export function resolveApiKey(explicit?: string): string | undefined {
  const fromOption = typeof explicit === "string" ? explicit.trim() : "";
  if (fromOption !== "") return fromOption;

  return readEnv("SERPAPI_API_KEY") ?? readEnv("SERPAPI_KEY");
}

/** Fills in every default once, when the tool is created. */
export function resolveOptions(options: SerpApiToolOptions = {}): ResolvedOptions {
  return {
    apiKey: resolveApiKey(options.apiKey),
    defaults: options.defaults ?? {},
    maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    cache: options.cache === false || options.cache === undefined ? null : new SearchCache(options.cache),
    fetch: options.fetch,
  };
}

/**
 * Removes anything that could expose the key from a message we are about to
 * return.
 *
 * Two passes, because they catch different things. The first removes the key
 * itself wherever it appears. The second removes anything shaped like an
 * `api_key=` query parameter, which covers a key we were never told about —
 * for example one echoed back inside a SerpApi error message.
 *
 * This is the last line of defence, not the first: the key is only ever set on
 * the request URL and is never placed into `params`, logs or results.
 */
export function redactSecrets(message: string, apiKey: string | undefined): string {
  let safe = message;

  if (apiKey !== undefined && apiKey !== "") {
    safe = safe.split(apiKey).join("[redacted]");
  }

  return safe.replace(/api_key=[^&\s"']+/gi, "api_key=[redacted]");
}

/**
 * Turns caller-supplied values into the flat string map SerpApi expects,
 * dropping anything not set.
 */
export function cleanParams(
  params: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const asText = String(value).trim();
    if (asText === "") continue;
    cleaned[key] = asText;
  }

  return cleaned;
}

function describeThrown(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Whether the caller has cancelled.
 *
 * This is a function rather than an inline `signal?.aborted === true` check on
 * purpose. We test the same signal twice — once before starting and again after
 * a failed request — and TypeScript would otherwise carry the first result
 * forward and call the second check dead code. It is not: the signal can abort
 * while the request is in flight, which is the interesting case.
 */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * Sends one search to SerpApi.
 *
 * Never throws. Every failure — no key, bad parameters, HTTP error, timeout,
 * cancellation — comes back as `{ ok: false, error }` so the calling tool can
 * hand the model a sentence it can act on.
 *
 * @param abortSignal The signal the AI SDK passes into `execute`. When the
 *   surrounding generation is cancelled, the in-flight request is dropped too.
 */
export async function search(
  engine: string,
  params: Record<string, string>,
  options: ResolvedOptions,
  abortSignal?: AbortSignal,
): Promise<SearchOutcome> {
  if (options.apiKey === undefined) {
    return { ok: false, error: MISSING_KEY_MESSAGE };
  }

  // Cancelled before we even started — no point spending a credit.
  if (isAborted(abortSignal)) {
    return { ok: false, error: "The search was cancelled before it started." };
  }

  const cacheKey = buildCacheKey(engine, params);
  const cached = options.cache?.get(cacheKey);
  if (cached !== undefined) {
    return { ok: true, data: cached as Record<string, unknown> };
  }

  const url = new URL(SERPAPI_SEARCH_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("engine", engine);
  url.searchParams.set("output", "json");
  // Set last and never logged. This URL object does not leave this function.
  url.searchParams.set("api_key", options.apiKey);

  // `AbortSignal.timeout` fires on its own schedule; `AbortSignal.any` lets the
  // caller's signal cancel us too. Keeping a reference to the timeout signal is
  // how we tell "timed out" apart from "the user cancelled" afterwards.
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signal =
    abortSignal === undefined ? timeoutSignal : AbortSignal.any([abortSignal, timeoutSignal]);

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      error:
        "No fetch implementation is available. Use Node 18 or newer, or pass a `fetch` option.",
    };
  }

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    if (isAborted(abortSignal)) {
      return { ok: false, error: "The search was cancelled before it finished." };
    }
    if (timeoutSignal.aborted) {
      return {
        ok: false,
        error: `The SerpApi request timed out after ${options.timeoutMs} ms. Try again, or raise \`timeoutMs\`.`,
      };
    }
    return {
      ok: false,
      error: redactSecrets(`Could not reach SerpApi: ${describeThrown(cause)}`, options.apiKey),
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  const data = (body as Record<string, unknown> | undefined) ?? {};
  const apiError = typeof data["error"] === "string" ? (data["error"] as string) : undefined;

  // A valid search that matched nothing. Report it as an empty result set.
  if (apiError !== undefined && NO_RESULTS_PATTERN.test(apiError)) {
    return { ok: true, data: {} };
  }

  if (!response.ok) {
    const detail = apiError ?? `HTTP ${response.status} ${response.statusText}`.trim();
    return {
      ok: false,
      error: redactSecrets(`SerpApi request failed: ${detail}`, options.apiKey),
    };
  }

  if (apiError !== undefined) {
    return {
      ok: false,
      error: redactSecrets(`SerpApi returned an error: ${apiError}`, options.apiKey),
    };
  }

  options.cache?.set(cacheKey, data);
  return { ok: true, data };
}
