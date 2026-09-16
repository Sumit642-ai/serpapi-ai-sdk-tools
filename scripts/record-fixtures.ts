/**
 * Records real SerpApi responses as test fixtures.
 *
 * Run it with:
 *
 *   npm run fixtures
 *
 * THIS SPENDS REAL SEARCH CREDITS — one per engine, six in total. The free
 * SerpApi plan allows 250 a month, so this costs about 2.4% of a month's
 * allowance. Everything else in this repository runs against these saved files
 * with a mocked fetch and never touches the network.
 *
 * Why raw responses: the fixtures must be exactly what SerpApi sent, so the
 * compaction functions are tested against reality rather than against our own
 * idea of it. This script therefore calls the API directly instead of going
 * through the package's own client.
 *
 * Safety: every response is scrubbed before it is written, and the script
 * refuses to save a file that still contains anything key-shaped.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEARCH_URL = "https://serpapi.com/search";
const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "serpapi-ai-sdk-tools",
  "test",
  "fixtures",
);

/** A SerpApi key is 64 lowercase hex characters. Used as a final tripwire. */
const KEY_SHAPED = /\b[0-9a-f]{64}\b/;

/** Dates are generated so a re-run years from now still searches the future. */
function daysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const OUTBOUND_DATE = daysFromToday(30);
const RETURN_DATE = daysFromToday(35);
const CHECK_IN_DATE = daysFromToday(30);
const CHECK_OUT_DATE = daysFromToday(32);

/**
 * One recording per engine. The queries are deliberately India-flavoured, to
 * match the examples in the README and the demo.
 */
const RECORDINGS: Array<{ file: string; engine: string; params: Record<string, string> }> = [
  {
    file: "web.json",
    engine: "google_light",
    params: { q: "what is serpapi", gl: "in", hl: "en" },
  },
  {
    file: "news.json",
    engine: "google_news",
    params: { q: "ISRO", gl: "in", hl: "en" },
  },
  {
    file: "maps.json",
    engine: "google_maps",
    params: { q: "cafes near Connaught Place, New Delhi", type: "search", hl: "en" },
  },
  {
    file: "shopping.json",
    engine: "google_shopping",
    params: { q: "budget wireless earbuds", gl: "in", hl: "en" },
  },
  {
    file: "flights.json",
    engine: "google_flights",
    params: {
      departure_id: "DEL",
      arrival_id: "GOX",
      outbound_date: OUTBOUND_DATE,
      return_date: RETURN_DATE,
      type: "1",
      currency: "INR",
      gl: "in",
      hl: "en",
    },
  },
  {
    file: "hotels.json",
    engine: "google_hotels",
    params: {
      q: "hotels in Jaipur",
      check_in_date: CHECK_IN_DATE,
      check_out_date: CHECK_OUT_DATE,
      adults: "2",
      currency: "INR",
      gl: "in",
      hl: "en",
    },
  },
];

/**
 * Loads .env if there is one.
 *
 * Node can do this itself since v20.12, so the repository needs no dotenv
 * dependency. A missing file is fine — the key may already be exported in the
 * shell.
 */
function loadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No .env present. Fall through to whatever is already in the environment.
  }
}

function resolveApiKey(): string {
  const key = (process.env["SERPAPI_API_KEY"] ?? process.env["SERPAPI_KEY"] ?? "").trim();

  if (key === "") {
    console.error(
      "\nNo SerpApi key found.\n\n" +
        "  1. Copy-Item .env.example .env\n" +
        "  2. Open .env and replace your_serpapi_key_here with your real key\n" +
        "  3. Run npm run fixtures again\n\n" +
        "Get a free key at https://serpapi.com/manage-api-key\n",
    );
    process.exit(1);
  }

  return key;
}

/**
 * Removes anything secret from a recorded response.
 *
 * Walks the whole structure rather than only the top level, because SerpApi
 * nests URLs several levels deep (pagination links, "see more" endpoints) and
 * any one of them could carry a credential.
 */
function scrub(value: unknown, apiKey: string): unknown {
  if (typeof value === "string") {
    return value
      .split(apiKey)
      .join("REDACTED")
      .replace(/api_key=[^&"'\s]+/gi, "api_key=REDACTED");
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, apiKey));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      // Drop credential-bearing keys outright rather than redacting them.
      if (key === "api_key") continue;

      // search_metadata holds the request id and links back to the raw HTML
      // and JSON of this specific search. None of it is useful to a test, and
      // it is the most likely place for something identifying to hide.
      if (key === "search_metadata") continue;

      result[key] = scrub(nested, apiKey);
    }

    return result;
  }

  return value;
}

async function record(
  recording: (typeof RECORDINGS)[number],
  apiKey: string,
): Promise<"saved" | "failed"> {
  const url = new URL(SEARCH_URL);
  for (const [key, value] of Object.entries(recording.params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("engine", recording.engine);
  url.searchParams.set("output", "json");
  url.searchParams.set("api_key", apiKey);

  process.stdout.write(`  ${recording.engine.padEnd(16)} `);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.log(`FAILED (${message.split(apiKey).join("REDACTED")})`);
    return "failed";
  }

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok || typeof body["error"] === "string") {
    const detail = typeof body["error"] === "string" ? body["error"] : `HTTP ${response.status}`;
    console.log(`FAILED (${detail.split(apiKey).join("REDACTED")})`);
    return "failed";
  }

  const cleaned = scrub(body, apiKey);
  const serialised = `${JSON.stringify(cleaned, null, 2)}\n`;

  // Final tripwire. If anything key-shaped survived the scrub, write nothing —
  // a missing fixture is a much smaller problem than a committed key.
  if (serialised.includes(apiKey) || KEY_SHAPED.test(serialised)) {
    console.log("FAILED (something key-shaped survived scrubbing; nothing written)");
    return "failed";
  }

  writeFileSync(join(FIXTURES_DIR, recording.file), serialised, "utf8");

  const sizeKb = (Buffer.byteLength(serialised) / 1024).toFixed(1);
  console.log(`saved ${recording.file} (${sizeKb} KB)`);
  return "saved";
}

async function main(): Promise<void> {
  loadEnvFile();
  const apiKey = resolveApiKey();

  mkdirSync(FIXTURES_DIR, { recursive: true });

  console.log(
    `\nRecording ${RECORDINGS.length} real SerpApi searches (${RECORDINGS.length} credits).\n` +
      `Existing fixtures in test/fixtures will be overwritten.\n`,
  );

  let saved = 0;
  let failed = 0;

  for (const recording of RECORDINGS) {
    const outcome = await record(recording, apiKey);
    if (outcome === "saved") saved += 1;
    else failed += 1;
  }

  console.log(`\nDone. ${saved} saved, ${failed} failed. ${RECORDINGS.length} credits used.`);
  console.log("Next: npm test\n");

  // A partial recording is still useful, but the exit code should say so.
  if (failed > 0) process.exit(1);
}

await main();
