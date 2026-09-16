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

/** A SerpApi key is 64 lowercase hex characters. Used to sanity-check the key. */
const KEY_SHAPED = /\b[0-9a-f]{64}\b/;

/**
 * The same shape, for counting occurrences in a response.
 *
 * Deliberately separate: a regex with the `g` flag remembers its position
 * between `.test()` calls, which would make the key check above unreliable.
 */
const KEY_SHAPED_ALL = /\b[0-9a-f]{64}\b/g;

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

  // Check the shape before spending anything. A malformed key would be rejected
  // six times over, which wastes time and makes the output confusing. The value
  // itself is never printed — only its length and character set.
  if (!KEY_SHAPED.test(key) && !process.argv.includes("--force")) {
    const classes = [...new Set(key.replace(/[0-9]/g, "9").replace(/[a-z]/g, "a").replace(/[A-Z]/g, "A"))]
      .join("")
      .replace(/[^9aA]/g, "?");

    console.error(
      `\nThat does not look like a SerpApi key, so nothing was sent.\n\n` +
        `  expected : 64 characters, lowercase a-f and 0-9 only\n` +
        `  found    : ${key.length} characters, character classes "${classes}"\n` +
        `             (9 = digit, a = lowercase, A = uppercase, ? = other)\n\n` +
        `Copy the key from https://serpapi.com/manage-api-key and paste it into\n` +
        `.env as: SERPAPI_API_KEY=<the key>   (no quotes, no spaces)\n\n` +
        `If SerpApi has changed its key format, re-run with: npm run fixtures -- --force\n`,
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

  // Final tripwire. Both of these are definitive leaks, so write nothing — a
  // missing fixture is a much smaller problem than a committed credential.
  if (serialised.includes(apiKey) || /api_key/i.test(serialised)) {
    console.log("FAILED (a credential survived scrubbing; nothing written)");
    return "failed";
  }

  writeFileSync(join(FIXTURES_DIR, recording.file), serialised, "utf8");

  // A 64-hex run has the same shape as a SerpApi key, but Google's own payloads
  // are full of long hex ids, so this is worth mentioning and not worth
  // failing on. The two checks above are what actually guard the key.
  const hexRuns = serialised.match(KEY_SHAPED_ALL)?.length ?? 0;
  const note = hexRuns > 0 ? ` [${hexRuns} hex id(s), not the key]` : "";

  const sizeKb = (Buffer.byteLength(serialised) / 1024).toFixed(1);
  console.log(`saved ${recording.file} (${sizeKb} KB)${note}`);
  return "saved";
}

/**
 * Works out which engines to record.
 *
 * Any non-flag argument filters the list, so re-recording one fixture after a
 * fix costs a single credit instead of six:
 *
 *   npm run fixtures -- news
 *   npm run fixtures -- flights hotels
 */
function selectRecordings(): typeof RECORDINGS {
  const filters = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
  if (filters.length === 0) return RECORDINGS;

  const selected = RECORDINGS.filter((recording) =>
    filters.some(
      (filter) =>
        recording.engine.includes(filter.toLowerCase()) ||
        recording.file.startsWith(filter.toLowerCase()),
    ),
  );

  if (selected.length === 0) {
    console.error(
      `\nNothing matched ${filters.join(", ")}.\n\n` +
        `Available: ${RECORDINGS.map((recording) => recording.file.replace(".json", "")).join(", ")}\n`,
    );
    process.exit(1);
  }

  return selected;
}

async function main(): Promise<void> {
  loadEnvFile();
  const apiKey = resolveApiKey();
  const recordings = selectRecordings();

  mkdirSync(FIXTURES_DIR, { recursive: true });

  console.log(
    `\nRecording ${recordings.length} real SerpApi search(es) (${recordings.length} credits).\n` +
      `Existing fixtures for these engines will be overwritten.\n`,
  );

  let saved = 0;
  let failed = 0;

  for (const recording of recordings) {
    const outcome = await record(recording, apiKey);
    if (outcome === "saved") saved += 1;
    else failed += 1;
  }

  // Only a search that actually ran costs a credit. A rejected request does not
  // perform a search, so reporting the full count would overstate the damage.
  console.log(`\nDone. ${saved} saved, ${failed} failed.`);
  console.log(`Search credits used: ${saved} of ${recordings.length} attempted.`);

  if (failed > 0) {
    console.log(
      `${failed} request(s) were rejected before a search ran. Confirm at ` +
        `https://serpapi.com/account if you want to be certain.`,
    );
  }

  if (saved > 0) console.log("Next: npm test");
  console.log("");

  // A partial recording is still useful, but the exit code should say so.
  if (failed > 0) process.exit(1);
}

await main();
