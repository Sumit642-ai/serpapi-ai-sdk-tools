import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { webSearch } from "../src/index.js";
import { FAKE_KEY, callTool, createFetchMock, expectError, expectSuccess } from "./helpers.js";
import webFixture from "./fixtures/web.json";

/**
 * The environment is shared between tests, so anything that touches the key
 * variables must put them back afterwards.
 */
const KEY_VARIABLES = ["SERPAPI_API_KEY", "SERPAPI_KEY"] as const;
let savedEnvironment: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnvironment = {};
  for (const name of KEY_VARIABLES) {
    savedEnvironment[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of KEY_VARIABLES) {
    const original = savedEnvironment[name];
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
});

describe("api key resolution", () => {
  it("returns a helpful error when no key is configured anywhere", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ fetch: mock.fetch });

    const message = expectError(await callTool(tool, { query: "serpapi" }));

    expect(message).toContain("No SerpApi key was found");
    expect(message).toContain("SERPAPI_API_KEY");
    // A missing key must not cost a request.
    expect(mock.calls).toHaveLength(0);
  });

  it("reads SERPAPI_API_KEY from the environment", async () => {
    process.env["SERPAPI_API_KEY"] = FAKE_KEY;
    const mock = createFetchMock({ body: webFixture });

    const result = expectSuccess(await callTool(webSearch({ fetch: mock.fetch }), { query: "a" }));

    expect(result.results.length).toBeGreaterThan(0);
    expect(mock.calls[0]?.params["api_key"]).toBe(FAKE_KEY);
  });

  it("falls back to SERPAPI_KEY", async () => {
    process.env["SERPAPI_KEY"] = FAKE_KEY;
    const mock = createFetchMock({ body: webFixture });

    expectSuccess(await callTool(webSearch({ fetch: mock.fetch }), { query: "a" }));

    expect(mock.calls[0]?.params["api_key"]).toBe(FAKE_KEY);
  });

  it("prefers an explicit apiKey over the environment", async () => {
    process.env["SERPAPI_API_KEY"] = "key-from-environment";
    const mock = createFetchMock({ body: webFixture });

    await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "a" });

    expect(mock.calls[0]?.params["api_key"]).toBe(FAKE_KEY);
  });

  it("treats a blank environment variable as no key at all", async () => {
    process.env["SERPAPI_API_KEY"] = "   ";
    const mock = createFetchMock({ body: webFixture });

    const message = expectError(await callTool(webSearch({ fetch: mock.fetch }), { query: "a" }));

    expect(message).toContain("No SerpApi key was found");
  });
});

describe("request building", () => {
  it("sends the engine, query and output format", async () => {
    const mock = createFetchMock({ body: webFixture });

    await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "serpapi docs" });

    const call = mock.calls[0];
    expect(call?.url.origin).toBe("https://serpapi.com");
    expect(call?.url.pathname).toBe("/search");
    expect(call?.params["engine"]).toBe("google_light");
    expect(call?.params["q"]).toBe("serpapi docs");
    expect(call?.params["output"]).toBe("json");
  });

  it("applies configured defaults", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({
      apiKey: FAKE_KEY,
      fetch: mock.fetch,
      defaults: { gl: "in", hl: "en", location: "Bengaluru, Karnataka, India" },
    });

    await callTool(tool, { query: "chai" });

    expect(mock.calls[0]?.params).toMatchObject({
      gl: "in",
      hl: "en",
      location: "Bengaluru, Karnataka, India",
    });
  });

  it("lets a tool call override the defaults, and lowercases codes", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch, defaults: { gl: "in" } });

    await callTool(tool, { query: "chai", country: "US", language: "EN" });

    expect(mock.calls[0]?.params["gl"]).toBe("us");
    expect(mock.calls[0]?.params["hl"]).toBe("en");
  });

  it("sends num only for the full google engine", async () => {
    const lightMock = createFetchMock({ body: webFixture });
    await callTool(webSearch({ apiKey: FAKE_KEY, fetch: lightMock.fetch }), { query: "a" });
    // google_light has no num parameter, so sending one would be meaningless.
    expect(lightMock.calls[0]?.params["num"]).toBeUndefined();

    const fullMock = createFetchMock({ body: webFixture });
    await callTool(
      webSearch({ apiKey: FAKE_KEY, fetch: fullMock.fetch, engine: "google", maxResults: 3 }),
      { query: "a" },
    );
    expect(fullMock.calls[0]?.params["num"]).toBe("3");
    expect(fullMock.calls[0]?.params["engine"]).toBe("google");
  });
});

describe("error handling", () => {
  it("reports a SerpApi error field as a readable message", async () => {
    const mock = createFetchMock({
      body: { error: "Invalid API key. Your API key should be here: https://serpapi.com/manage-api-key" },
      status: 401,
      statusText: "Unauthorized",
    });

    const message = expectError(
      await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "a" }),
    );

    expect(message).toContain("SerpApi request failed");
    expect(message).toContain("Invalid API key");
  });

  it("reports an HTTP failure that carries no error field", async () => {
    const mock = createFetchMock({ body: {}, status: 500, statusText: "Internal Server Error" });

    const message = expectError(
      await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "a" }),
    );

    expect(message).toContain("500");
  });

  it("reports a network failure without throwing", async () => {
    const mock = createFetchMock({ throws: new TypeError("fetch failed") });

    const message = expectError(
      await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "a" }),
    );

    expect(message).toContain("Could not reach SerpApi");
    expect(message).toContain("fetch failed");
  });

  it("survives a response body that is not JSON", async () => {
    const mock = createFetchMock({ rawBody: "<html>gateway timeout</html>", status: 504 });

    const message = expectError(
      await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "a" }),
    );

    expect(message).toContain("504");
  });

  it("treats 'no results' from SerpApi as an empty result, not an error", async () => {
    // SerpApi answers 200 with an error string when a valid search matched
    // nothing. Reporting that as a failure would make a model retry forever.
    const mock = createFetchMock({
      body: { error: "Google hasn't returned any results for this query." },
      status: 200,
    });

    const result = expectSuccess(
      await callTool(webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), { query: "asdkjhasd" }),
    );

    expect(result.results).toEqual([]);
    expect(result.note).toBe("No results found");
  });
});

describe("timeout and cancellation", () => {
  it("gives up after timeoutMs", async () => {
    const mock = createFetchMock({ body: webFixture, delayMs: 200 });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch, timeoutMs: 20 });

    const message = expectError(await callTool(tool, { query: "a" }));

    expect(message).toContain("timed out after 20 ms");
  });

  it("stops when the caller's abort signal fires mid-request", async () => {
    const mock = createFetchMock({ body: webFixture, delayMs: 200 });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });
    const controller = new AbortController();

    const pending = callTool(tool, { query: "a" }, { abortSignal: controller.signal });
    setTimeout(() => controller.abort(), 10);

    expect(expectError(await pending)).toContain("cancelled before it finished");
  });

  it("does not spend a request when the signal is already aborted", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, { query: "a" }, { abortSignal: AbortSignal.abort() }),
    );

    expect(message).toContain("cancelled before it started");
    expect(mock.calls).toHaveLength(0);
  });
});

describe("cache", () => {
  it("serves a repeated search from memory instead of spending a credit", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch, cache: { ttlMs: 60_000 } });

    const first = expectSuccess(await callTool(tool, { query: "same question" }));
    const second = expectSuccess(await callTool(tool, { query: "same question" }));

    expect(mock.calls).toHaveLength(1);
    expect(second.results).toEqual(first.results);
  });

  it("treats a different query as a different entry", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch, cache: { ttlMs: 60_000 } });

    await callTool(tool, { query: "one" });
    await callTool(tool, { query: "two" });

    expect(mock.calls).toHaveLength(2);
  });

  it("re-fetches once an entry has expired", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch, cache: { ttlMs: 5 } });

    await callTool(tool, { query: "same" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await callTool(tool, { query: "same" });

    expect(mock.calls).toHaveLength(2);
  });

  it("is off unless asked for", async () => {
    const mock = createFetchMock({ body: webFixture });
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    await callTool(tool, { query: "same" });
    await callTool(tool, { query: "same" });

    expect(mock.calls).toHaveLength(2);
  });

  it("does not cache failures", async () => {
    const mock = createFetchMock([
      { body: { error: "Invalid API key" }, status: 401 },
      { body: webFixture, status: 200 },
    ]);
    const tool = webSearch({ apiKey: FAKE_KEY, fetch: mock.fetch, cache: { ttlMs: 60_000 } });

    expectError(await callTool(tool, { query: "same" }));
    // A transient failure must not poison the cache for later calls.
    expectSuccess(await callTool(tool, { query: "same" }));

    expect(mock.calls).toHaveLength(2);
  });
});
