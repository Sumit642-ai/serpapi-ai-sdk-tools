import { describe, expect, it } from "vitest";

import { serpApiTools } from "../src/index.js";
import { FAKE_KEY, callTool, createFetchMock, expectSuccess } from "./helpers.js";
import flightsFixture from "./fixtures/flights.json";
import hotelsFixture from "./fixtures/hotels.json";
import mapsFixture from "./fixtures/maps.json";
import newsFixture from "./fixtures/news.json";
import shoppingFixture from "./fixtures/shopping.json";
import webFixture from "./fixtures/web.json";

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Each tool, the engine it must call, and a valid input for it. */
const TOOL_CASES = [
  { key: "webSearch", engine: "google_light", fixture: webFixture, input: { query: "serpapi" } },
  { key: "newsSearch", engine: "google_news", fixture: newsFixture, input: { query: "ISRO" } },
  { key: "mapsSearch", engine: "google_maps", fixture: mapsFixture, input: { query: "cafes in Delhi" } },
  {
    key: "shoppingSearch",
    engine: "google_shopping",
    fixture: shoppingFixture,
    input: { query: "earbuds" },
  },
  {
    key: "flightsSearch",
    engine: "google_flights",
    fixture: flightsFixture,
    input: { departureId: "DEL", arrivalId: "GOX", outboundDate: futureDate(14) },
  },
  {
    key: "hotelsSearch",
    engine: "google_hotels",
    fixture: hotelsFixture,
    input: { query: "hotels in Jaipur", checkInDate: futureDate(14), checkOutDate: futureDate(16) },
  },
] as const;

describe("serpApiTools", () => {
  it("returns all six tools by default", () => {
    const tools = serpApiTools({ apiKey: FAKE_KEY });

    expect(Object.keys(tools).sort()).toEqual([
      "flightsSearch",
      "hotelsSearch",
      "mapsSearch",
      "newsSearch",
      "shoppingSearch",
      "webSearch",
    ]);
  });

  it("returns only the tools named in include", () => {
    const tools = serpApiTools({ apiKey: FAKE_KEY, include: ["flights", "hotels"] });

    expect(Object.keys(tools).sort()).toEqual(["flightsSearch", "hotelsSearch"]);
    // The narrowed type is the point of `include` — these must be reachable
    // without a cast, and the rest must not exist.
    expect(tools.flightsSearch).toBeDefined();
    expect("webSearch" in tools).toBe(false);
  });

  it("returns an empty object for an empty include list", () => {
    expect(Object.keys(serpApiTools({ apiKey: FAKE_KEY, include: [] }))).toEqual([]);
  });

  it("gives every tool a description and a schema for the model", () => {
    const tools = serpApiTools({ apiKey: FAKE_KEY });

    for (const [name, tool] of Object.entries(tools)) {
      const described = tool as { description?: string; inputSchema?: unknown };

      expect(described.description, `${name} needs a description`).toBeTruthy();
      expect(described.description!.length, `${name} description is too short`).toBeGreaterThan(60);
      expect(described.inputSchema, `${name} needs an inputSchema`).toBeDefined();
    }
  });
});

describe("each tool calls the right engine", () => {
  for (const testCase of TOOL_CASES) {
    it(`${testCase.key} uses ${testCase.engine}`, async () => {
      const mock = createFetchMock({ body: testCase.fixture });
      const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch });

      const result = expectSuccess(await callTool(tools[testCase.key], testCase.input));

      expect(mock.calls[0]?.params["engine"]).toBe(testCase.engine);
      expect(result.engine).toBe(testCase.engine);
      expect(result.results.length).toBeGreaterThan(0);
    });
  }
});

describe("empty results", () => {
  for (const testCase of TOOL_CASES) {
    it(`${testCase.key} reports no results as a note, not an error`, async () => {
      // An empty but otherwise valid SerpApi response.
      const mock = createFetchMock({ body: { search_metadata: { status: "Success" } } });
      const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch });

      const result = expectSuccess(await callTool(tools[testCase.key], testCase.input));

      expect(result.results).toEqual([]);
      expect(result.note).toBe("No results found");
    });
  }
});

describe("maxResults", () => {
  it("trims the list the model sees", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch, maxResults: 2 });

    const result = expectSuccess(await callTool(tools.webSearch, { query: "serpapi" }));

    // The fixture has three organic results.
    expect(result.results).toHaveLength(2);
  });

  it("defaults to five", async () => {
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: createFetchMock({ body: webFixture }).fetch });

    const result = expectSuccess(await callTool(tools.webSearch, { query: "serpapi" }));

    expect(result.results.length).toBeLessThanOrEqual(5);
  });
});

describe("shared options reach every tool", () => {
  it("applies defaults built by serpApiTools", async () => {
    const mock = createFetchMock({ body: hotelsFixture });
    const tools = serpApiTools({
      apiKey: FAKE_KEY,
      fetch: mock.fetch,
      defaults: { gl: "in", hl: "en", currency: "INR" },
    });

    await callTool(tools.hotelsSearch, {
      query: "hotels in Jaipur",
      checkInDate: futureDate(14),
      checkOutDate: futureDate(16),
    });

    expect(mock.calls[0]?.params).toMatchObject({ gl: "in", hl: "en", currency: "INR" });
  });

  it("does not send a currency to google_shopping, which has no such parameter", async () => {
    const mock = createFetchMock({ body: shoppingFixture });
    const tools = serpApiTools({
      apiKey: FAKE_KEY,
      fetch: mock.fetch,
      defaults: { gl: "in", currency: "INR" },
    });

    await callTool(tools.shoppingSearch, { query: "earbuds" });

    // The store front (gl) is what decides the currency shown.
    expect(mock.calls[0]?.params["currency"]).toBeUndefined();
    expect(mock.calls[0]?.params["gl"]).toBe("in");
  });

  it("gives each tool its own cache", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch, cache: { ttlMs: 60_000 } });

    await callTool(tools.webSearch, { query: "same" });
    await callTool(tools.webSearch, { query: "same" });

    expect(mock.calls).toHaveLength(1);
  });
});

describe("maps coordinates", () => {
  it("builds the @lat,lng,zoom string Google Maps expects", async () => {
    const mock = createFetchMock({ body: mapsFixture });
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch });

    await callTool(tools.mapsSearch, {
      query: "cafes",
      latitude: 28.6304,
      longitude: 77.2177,
    });

    expect(mock.calls[0]?.params["ll"]).toBe("@28.6304,77.2177,14z");
    expect(mock.calls[0]?.params["type"]).toBe("search");
  });

  it("ignores a latitude sent without a longitude", async () => {
    const mock = createFetchMock({ body: mapsFixture });
    const tools = serpApiTools({ apiKey: FAKE_KEY, fetch: mock.fetch });

    await callTool(tools.mapsSearch, { query: "cafes", latitude: 28.6304 });

    expect(mock.calls[0]?.params["ll"]).toBeUndefined();
  });

  it("folds a default location into the query, since google_maps has no location parameter", async () => {
    const mock = createFetchMock({ body: mapsFixture });
    const tools = serpApiTools({
      apiKey: FAKE_KEY,
      fetch: mock.fetch,
      defaults: { location: "New Delhi, India" },
    });

    await callTool(tools.mapsSearch, { query: "cafes" });

    expect(mock.calls[0]?.params["q"]).toBe("cafes New Delhi, India");
    expect(mock.calls[0]?.params["location"]).toBeUndefined();
  });

  it("does not repeat a location the query already names", async () => {
    const mock = createFetchMock({ body: mapsFixture });
    const tools = serpApiTools({
      apiKey: FAKE_KEY,
      fetch: mock.fetch,
      defaults: { location: "New Delhi" },
    });

    await callTool(tools.mapsSearch, { query: "cafes in new delhi" });

    expect(mock.calls[0]?.params["q"]).toBe("cafes in new delhi");
  });
});
