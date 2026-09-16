import { describe, expect, it } from "vitest";

import { SERPAPI_SEARCH_URL } from "../src/index.js";
import type { SerpApiToolOptions, ToolResult } from "../src/index.js";

/**
 * Phase 2 smoke test. It proves the toolchain works end to end — TypeScript
 * compiles, vitest runs, and the package's own exports resolve — before any
 * real logic exists. Phase 3 adds the tests that matter.
 */
describe("package skeleton", () => {
  it("points at the documented SerpApi endpoint", () => {
    expect(SERPAPI_SEARCH_URL).toBe("https://serpapi.com/search");
  });

  it("accepts the documented shared options", () => {
    const options: SerpApiToolOptions = {
      defaults: { gl: "in", hl: "en", currency: "INR" },
      maxResults: 5,
      timeoutMs: 30_000,
      cache: { ttlMs: 60_000 },
    };

    expect(options.defaults?.gl).toBe("in");
  });

  it("narrows a tool result to either success or error", () => {
    const result: ToolResult<{ title: string }> = {
      engine: "google_light",
      params: { q: "serpapi" },
      results: [{ title: "SerpApi" }],
    };

    // The `error` key is how callers tell the two shapes apart.
    expect("error" in result).toBe(false);
  });
});
