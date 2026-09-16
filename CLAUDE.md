# serpapi-ai-sdk-tools — project brief

## What this project is

A community, open-source TypeScript package that gives Vercel AI SDK apps ready-made
SerpApi search tools: web, news, maps, shopping, flights and hotels.

It is an entry for the SerpApi India Hackathon 2026, Open-Source Integrations track.
Deadline: October 5, 2026, 23:59 IST.

It is the TypeScript counterpart of SerpApi's official Python package
`serpapi-search-tools` (https://github.com/serpapi/serpapi-search-tools-python), which only
supports Python agent frameworks. Mirror its design ideas: one constructor per search type,
typed inputs validated before any request is sent, and compact results. Tool names should
feel familiar to people who know the Python package (`webSearch` ↔ `web_search`).

This is NOT an official SerpApi package. Every README must say so.

## About the owner

The owner is a beginner who builds by "vibe coding". Therefore:

- Before big changes, explain in plain language what you are about to do. Afterwards,
  summarise what changed.
- Prefer simple, readable code over clever code. Add short comments explaining *why*.
- When the owner must run something (keys, recording, publishing), give exact
  copy-paste commands.
- Work in small milestones. After each working milestone, suggest a short commit message.

## Hard rules (never break these)

1. Never open, print or commit `.env` files or API keys. Keys come only from environment
   variables: `SERPAPI_API_KEY` (also accept `SERPAPI_KEY`) and, for the demo,
   `GOOGLE_GENERATIVE_AI_API_KEY`.
2. The API key must never appear in errors, logs, tool output or test fixtures.
3. Never run `npm publish`, create npm tokens, or change npm or GitHub account settings.
   The owner publishes manually.
4. Unit tests must never call the real SerpApi (the free plan has 250 searches a month).
   Use recorded fixtures and a mocked `fetch`.
5. Never spend real searches without asking first. Say how many searches a command will use.
6. npm v12 turns off dependency install scripts by default. If something breaks because of
   this, explain it and ask before enabling any scripts.
7. Check current docs before writing code. Do not rely on memory for parameter or field names.
   - AI SDK: https://ai-sdk.dev/llms.txt
   - Tool package template: https://github.com/vercel-labs/ai-sdk-tool-as-package-template
   - SerpApi: https://serpapi.com/search-api and each engine's documentation page

## Repository layout (npm workspaces)

```
/
├─ package.json                    private root with workspaces and scripts
├─ packages/serpapi-ai-sdk-tools/  the package that gets published
│  ├─ src/
│  │  ├─ index.ts                  public exports
│  │  ├─ client.ts                 fetch wrapper: URL, key, timeout, abort, errors, cache
│  │  ├─ tools/                    web.ts news.ts maps.ts shopping.ts flights.ts hotels.ts
│  │  ├─ compact/                  turns raw SerpApi JSON into small, predictable objects
│  │  └─ types.ts
│  ├─ test/  and  test/fixtures/   vitest tests and recorded responses
│  ├─ README.md                    this becomes the npm page
│  ├─ LICENSE                      copy of the root MIT license
│  └─ package.json
├─ examples/
│  ├─ basic/                       tiny Node script using generateText
│  └─ chat/                        Next.js chat demo (used for the demo video)
├─ scripts/record-fixtures.ts      one-off: real searches → cleaned JSON fixtures
├─ .github/workflows/ci.yml        install, typecheck, test, build
├─ .env.example                    placeholder values only
└─ README.md                       project overview for the judges
```

## Package design

- Peer dependencies: `ai` (use the current major version; check it) and `zod`.
- No runtime dependencies. Call SerpApi with the built-in `fetch` (Node 18+).
- Build with tsup to ESM, CommonJS and `.d.ts`. Use an `exports` map, `files: ["dist"]`,
  `sideEffects: false`, and the MIT license.
- Each tool is a factory function that returns an AI SDK `tool()`:
  `webSearch`, `newsSearch`, `mapsSearch`, `shoppingSearch`, `flightsSearch`, `hotelsSearch`.
- Convenience helper: `serpApiTools(options?)` returns all six tools, or a subset via
  an `include` option.
- Shared options:
  - `apiKey` — falls back to the environment variables above.
  - `defaults` — `{ gl, hl, location, currency }`.
  - `maxResults` — default 5.
  - `timeoutMs` — default 30000.
  - `cache` — `{ ttlMs }` or `false`; an in-memory cache that saves credits.
  - `fetch` — injectable, for tests.
- Web search engine: default to `google_light` (fast, compact) if the docs confirm it,
  with an option to use `google`.
- Inputs (zod) ask only for what each search needs. Descriptions are written for the AI
  model: when to use the tool and what formats to send.
  - **flights:** 3-letter uppercase IATA codes; outbound date `YYYY-MM-DD`, not in the
    past; optional return date after outbound; adults; travel class; currency.
  - **hotels:** query; check-in and check-out dates (check-out after check-in); adults;
    currency.
  - **maps:** query; optional location or coordinates.
  - **web, news, shopping:** query; optional country and language.
- Outputs are compact and token-efficient.
  - Keep useful fields: titles, links, prices, ratings, addresses, dates, sources.
  - Drop metadata.
  - Always include the `engine` and the parameters used, with no API key.
  - Empty results return `{ results: [], note: "No results found" }`, not an error.
- Errors (missing key, SerpApi `error` field, HTTP errors, timeouts) return a clear
  `{ error: "..." }` message the model can act on. Never throw raw errors, and never
  include the key.
- Respect the `abortSignal` that the AI SDK passes to `execute`.
- India-friendly example in the docs: `defaults: { gl: "in", hl: "en", currency: "INR" }`.
  Document it, don't hard-code it.

## Demo app (examples/chat)

- Next.js (App Router) + AI SDK UI (`useChat`) + `@ai-sdk/google` (Gemini, free key).
- Read the model id from the `DEMO_MODEL` env variable, with a sensible current default.
  Verify the model name.
- Import the package through the workspace, never through relative `src` paths, so the
  demo proves it works as a real dependency.
- The chat route uses `streamText` with `serpApiTools()` and a multi-step stop condition.
- Render tool results as simple cards: flights, hotels, places, products, news, web links.
- Show a small "tool activity" line: which tool and engine ran, and with what inputs.
  This makes SerpApi usage obvious in the demo video.
- Add example prompt buttons:
  - Flights from Delhi to Goa next Friday
  - Cafes near Connaught Place
  - Best budget earbuds prices in India
  - Latest ISRO news
  - Hotels in Jaipur this weekend
- Clean, minimal design. Starts with `npm run dev` from the repo root.

## Commands (keep these working)

- `npm install`
- `npm test` — all tests, no network
- `npm run typecheck`
- `npm run build`
- `npm run dev` — starts the chat demo
- `npm run fixtures` — records fixtures with real searches; always ask first

## Definition of done

- All six tools return real SerpApi results in the demo.
- Tests cover validation, compaction, empty results, errors, missing key, key-never-leaked,
  cache and abort.
- `npm pack --dry-run` inside the package lists only `dist`, `README.md`, `LICENSE` and
  `package.json`.
- The package README has:
  - install steps and a 3-line quick start
  - every tool's inputs and outputs, and all options
  - the India example
  - a "why SerpApi" section and a "not official" note
- The root README has an AI-assisted development disclosure.
