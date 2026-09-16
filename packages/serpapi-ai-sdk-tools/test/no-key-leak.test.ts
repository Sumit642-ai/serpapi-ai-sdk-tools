import { describe, expect, it } from "vitest";

import { redactSecrets } from "../src/client.js";
import { serpApiTools } from "../src/index.js";
import { FAKE_KEY, callTool, createFetchMock, type MockResponseSpec } from "./helpers.js";
import flightsFixture from "./fixtures/flights.json";
import hotelsFixture from "./fixtures/hotels.json";
import mapsFixture from "./fixtures/maps.json";
import newsFixture from "./fixtures/news.json";
import shoppingFixture from "./fixtures/shopping.json";
import webFixture from "./fixtures/web.json";

/**
 * The API key must never reach the model, the logs, or anything a user can see.
 *
 * This file is the safety net for that promise. It drives every tool down every
 * path — success, SerpApi error, HTTP error, network failure, timeout — and
 * checks that the key appears in none of the output.
 */

/** Every tool, with an input that passes its own validation. */
function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const CASES = [
  { key: "webSearch", fixture: webFixture, input: { query: "serpapi" } },
  { key: "newsSearch", fixture: newsFixture, input: { query: "ISRO" } },
  { key: "mapsSearch", fixture: mapsFixture, input: { query: "cafes in Delhi" } },
  { key: "shoppingSearch", fixture: shoppingFixture, input: { query: "earbuds" } },
  {
    key: "flightsSearch",
    fixture: flightsFixture,
    input: { departureId: "DEL", arrivalId: "GOX", outboundDate: futureDate(14) },
  },
  {
    key: "hotelsSearch",
    fixture: hotelsFixture,
    input: {
      query: "hotels in Jaipur",
      checkInDate: futureDate(14),
      checkOutDate: futureDate(16),
    },
  },
] as const;

/** Failure shapes worth checking. The key could plausibly surface in any of them. */
const FAILURE_MODES: Array<{ name: string; spec: MockResponseSpec }> = [
  {
    name: "SerpApi error that echoes the request URL",
    // The nastiest realistic case: the service quotes our own URL back at us,
    // api_key and all.
    spec: {
      status: 401,
      body: {
        error: `Invalid API key for https://serpapi.com/search?q=test&api_key=${FAKE_KEY}`,
      },
    },
  },
  { name: "plain HTTP 500", spec: { status: 500, statusText: "Internal Server Error", body: {} } },
  {
    name: "network failure quoting the URL",
    spec: { throws: new TypeError(`request to https://serpapi.com/search?api_key=${FAKE_KEY} failed`) },
  },
  { name: "unparseable body", spec: { rawBody: "<html>error</html>", status: 502 } },
];

describe("redactSecrets", () => {
  it("removes the key wherever it appears", () => {
    const message = `failed for api_key=${FAKE_KEY} and again ${FAKE_KEY}`;

    const safe = redactSecrets(message, FAKE_KEY);

    expect(safe).not.toContain(FAKE_KEY);
    expect(safe).toContain("[redacted]");
  });

  it("removes an api_key parameter even for a key it was never told about", () => {
    // Covers a key echoed back by SerpApi that this process never held.
    const safe = redactSecrets("see https://serpapi.com/search?q=a&api_key=some_other_secret&gl=in", undefined);

    expect(safe).not.toContain("some_other_secret");
    expect(safe).toContain("api_key=[redacted]");
  });

  it("leaves ordinary text alone", () => {
    expect(redactSecrets("No results found", FAKE_KEY)).toBe("No results found");
  });
});

describe("the API key never leaks", () => {
  it("is sent to SerpApi but never echoed back in a successful result", async () => {
    for (const testCase of CASES) {
      const mock = createFetchMock({ body: testCase.fixture });
      const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch });
      const tool = tools[testCase.key];

      const result = await callTool(tool, testCase.input);
      const serialised = JSON.stringify(result);

      // It must reach SerpApi...
      expect(mock.calls[0]?.params["api_key"], `${testCase.key} should send the key`).toBe(FAKE_KEY);

      // ...and must not come back out.
      expect(serialised, `${testCase.key} leaked the key in its result`).not.toContain(FAKE_KEY);
      expect(serialised, `${testCase.key} echoed api_key in its params`).not.toContain("api_key");
    }
  });

  it("stays hidden on every failure path", async () => {
    for (const testCase of CASES) {
      for (const failure of FAILURE_MODES) {
        const mock = createFetchMock(failure.spec);
        const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch });

        const result = await callTool(tools[testCase.key], testCase.input);
        const serialised = JSON.stringify(result);

        expect(
          serialised,
          `${testCase.key} leaked the key on "${failure.name}"`,
        ).not.toContain(FAKE_KEY);
      }
    }
  });

  it("stays hidden when a request times out", async () => {
    const mock = createFetchMock({ body: webFixture, delayMs: 200 });
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch, timeoutMs: 10 });

    const result = await callTool(tools.webSearch, { query: "serpapi" });

    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it("never puts the key into the echoed params", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch, defaults: { gl: "in" } });

    const result = (await callTool(tools.webSearch, { query: "serpapi" })) as {
      params: Record<string, string>;
    };

    // The params we report back describe the search, not the credentials.
    expect(Object.keys(result.params)).not.toContain("api_key");
    expect(result.params).toMatchObject({ q: "serpapi", gl: "in" });
  });

  it("does not leak a key that only lives in the environment", async () => {
    const original = process.env["SERPAPI_API_KEY"];
    process.env["SERPAPI_API_KEY"] = FAKE_KEY;

    try {
      const mock = createFetchMock({ status: 401, body: { error: `bad key ${FAKE_KEY}` } });
      const tools = serpApiTools({ fetch: mock.fetch });

      const result = await callTool(tools.webSearch, { query: "serpapi" });

      expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
    } finally {
      if (original === undefined) {
        delete process.env["SERPAPI_API_KEY"];
      } else {
        process.env["SERPAPI_API_KEY"] = original;
      }
    }
  });
});

describe("test fixtures carry no secrets", () => {
  it("contains no api_key field or key-shaped string", () => {
    // Phase 4 replaces these with real recorded responses. This test is what
    // stops a recording from quietly committing a live key.
    for (const [name, fixture] of Object.entries({
      web: webFixture,
      news: newsFixture,
      maps: mapsFixture,
      shopping: shoppingFixture,
      flights: flightsFixture,
      hotels: hotelsFixture,
    })) {
      const serialised = JSON.stringify(fixture);

      expect(serialised, `${name} fixture contains an api_key`).not.toContain("api_key");

      // A SerpApi key is 64 lowercase hex characters. Nothing legitimate in a
      // search response looks like that, so a match means a key got recorded.
      expect(serialised, `${name} fixture contains a key-shaped string`).not.toMatch(
        /\b[0-9a-f]{64}\b/,
      );
    }
  });
});
