# PROGRESS

Working checklist for `serpapi-ai-sdk-tools`. Tick items as they finish so work can resume
if the session restarts.

- **Repo root:** `D:\serp-api-hackathon\serpapi-ai-sdk-tools`
- **Package name:** `serpapi-ai-sdk-tools`
- **Author / license holder:** Sumit642-ai
- **GitHub:** https://github.com/Sumit642-ai/serpapi-ai-sdk-tools
- **Platform:** Windows 11, PowerShell. Every script must be cross-platform (no `rm -rf`).

## Phase 0 — Setup

- [x] Read `CLAUDE.md`
- [x] Confirm name, repo URL, package name with the owner
- [x] Create `PROGRESS.md`

## Phase 1 — Research and plan

- [x] Read SerpApi Python package design (`serpapi-search-tools-python`)
- [x] Read AI SDK docs and verify the API against real `.d.ts` files
- [x] Read the Vercel tool-package template
- [x] Read SerpApi docs: `google_light`, `google`, `google_news`, `google_maps`,
      `google_shopping`, `google_flights`, `google_hotels`
- [x] Pin current versions and check Node
- [x] Owner approved the plan

## Phase 2 — Skeleton

- [x] npm workspace layout from `CLAUDE.md`
- [x] Keep root `LICENSE`, copy it into the package folder
- [x] `.gitignore` ignores `.env` and `.env.*` but keeps `.env.example` (already correct)
- [x] `.env.example` with placeholders only
- [x] `npm install`, `npm run typecheck`, `npm test` all pass
- [x] `npm run build` also proven (emits `index.d.ts` + `index.d.cts`)
- [x] Commit

### Decision: TypeScript is pinned to 5.9.3

The plan was to try TypeScript 7.0.2 (current `latest`) and fall back if the
toolchain was not ready. It was not:

| Version | `tsc --noEmit` | `tsup` JS output | `tsup` `.d.ts` output |
| ------- | -------------- | ---------------- | --------------------- |
| 7.0.2   | pass           | pass             | **fail** |
| 6.0.3   | pass           | pass             | **fail** |
| 5.9.3   | pass           | pass             | pass |

tsup builds declarations with `rollup-plugin-dts`, which calls the TypeScript
compiler API. TypeScript 6 and the native 7 rewrite both change that API
(`Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`).
Only the type declarations break — the JavaScript is fine on all three — but a
published package without `.d.ts` files is not worth shipping.

Revisit when tsup ships a `rollup-plugin-dts` that supports TypeScript 6+.
The reason is repeated as a comment in `packages/serpapi-ai-sdk-tools/tsup.config.ts`.

## Phase 3 — The package

- [x] `client.ts` — URL building, key resolution, timeout, abort, errors, cache
- [x] Six tools: web, news, maps, shopping, flights, hotels
- [x] Compaction functions
- [x] `serpApiTools()` with the `include` option (return type narrows to the subset)
- [x] Optional in-memory cache
- [x] Tests: validation, compaction, empty results, errors, missing key,
      key-never-leaked, cache, abort
- [x] `npm test` (92 tests), `npm run typecheck`, `npm run build` all pass
- [x] Commit

### Things worth remembering from Phase 3

- **A SerpApi "error" is not always an error.** A valid search that matched
  nothing comes back as HTTP 200 with `error: "Google hasn't returned any
  results for this query."` That is reported as `{ results: [], note: "No
  results found" }`, because returning an error would make a model retry the
  same search forever.
- **Google Flights infers its trip type.** `return_date` is required when
  `type=1` and forbidden when `type=2`, so `type` is derived from whether a
  return date was given instead of being asked for.
- **`google_light` has no `num` parameter,** so `maxResults` is applied after
  the response. The full `google` engine does get `num`.
- **`google_maps` has no `location` parameter,** unlike the web engines, so a
  configured default location is folded into the query text.
- **`google_shopping` has no `currency` parameter.** The store front (`gl`)
  decides the currency, so `defaults.currency` is deliberately not sent there.

### Open item for the Phase 6 review — now closed

`dist/index.d.ts` is ~83 KB: 2115 lines for 7 declarations, because TypeScript
writes each factory's inferred `tool()` return type out structurally.

**Decision: leave it.** The fix would be explicit return type annotations, which
need `Tool` and `ExecutableTool` — and those are not exported from `ai`. They
live in `@ai-sdk/provider-utils`, which this package does not depend on and
should not start depending on to solve a cosmetic problem. "No runtime
dependencies" is worth more than a smaller declaration file.

The file is correct: it does `import * as ai from 'ai'`, so consumer types
resolve against the consumer's own copy of the AI SDK.

## Phase 4 — Real fixtures (CHECKPOINT)

- [x] `scripts/record-fixtures.ts` (typechecks; dry run refuses to run with no key)
- [x] Root `tsconfig.json` added so `npm run typecheck` also covers `scripts/`
- [x] **STOP** — gave the owner the `.env` command and the search count (6)
- [x] Owner confirmed
- [x] Recorded all six engines — **6 credits used**, exactly as quoted
- [x] Audited every fixture: no key, no `api_key`, no `search_metadata`
- [x] Rewrote the compaction tests against real data — 109 tests pass
- [x] Commit

### What the real data changed

Fourteen tests failed on first contact with real responses. None were bugs in
the package — all were assertions written against fixture content I had
invented. Three things worth keeping in mind:

- **Recorded fixtures now test structure, not content.** Asserting a hotel's
  name or a flight's price means the suite breaks whenever anyone re-records,
  which teaches people to update expectations without reading them.
- **Real data does not cover every branch.** All nine recorded flights are
  non-stop and none of the 100 news results are grouped into `stories`, so the
  multi-leg, layover, airline-deduplication and story-flattening branches are
  tested against small inline responses where the input is visible.
- **Google's own data is inconsistent.** The same shopping response contains
  both `"amazon.in"` and `"Amazon.in"`. Tests assert types, not casing.

### A tripwire that was too strict

The recorder refused to write the news fixture because it contained a
64-character hex string — the shape of a SerpApi key. It was a Reuters image
URL with an `auth=` token in it. The rule was wrong in both the recorder and
the tests: a genuine leak always carries `api_key`, which is checked directly,
so the blanket hex rule only rejected real data. Replaced with exact checks for
`api_key` and `search_metadata`.

Fixture sizes total about 700 KB. They are not published — `files: ["dist"]`
means the npm package never includes `test/`.

The recorder spends **6 credits**, one per engine. It scrubs every response
before writing (drops `search_metadata` and any `api_key` key, redacts
key-shaped strings anywhere in the tree) and refuses to write a file if
anything key-shaped survives. Tests already assert the fixtures carry no
secrets, so a bad recording fails the suite rather than reaching a commit.

## Phase 5 — Examples and demo (CHECKPOINT)

- [x] `examples/basic`
- [x] `examples/chat` Next.js demo: result cards, tool activity line, prompt buttons
- [x] Package imported through the workspace (npm links it as a junction, so the
      demo consumes the built `dist` through the `exports` map, as a real app would)
- [x] `npm run dev` starts it — builds the package first, then Next
- [x] End-to-end verified for **0 search credits** (see below)
- [x] **STOP** — gave the owner 6 browser questions
- [x] Owner confirmed all six work in the browser
- [x] Commit

### The demo model had to change

`gemini-3.8-flash` was the planned default. It does not work. Measured time to
the first streamed token on the owner's free key, asking for a single word:

| Model | Time to first token |
| ----- | ------------------- |
| `gemini-3.6-flash` | **2.1s** — the new default |
| `gemini-3.1-flash-lite` | 3.8s |
| `gemini-3.5-flash` | 13.8s |
| `gemini-3.8-flash` | timed out at 30s |
| `gemini-flash-latest` | timed out at 30s |
| `gemini-2.5-flash` | 404 — no longer available to new keys |

A model that takes 30s makes a working demo look broken, which matters for the
video. The table is repeated in `.env.example` so the choice is not mysterious.

Also worth recording: the owner's Google key is **valid**. An earlier warning
that it "looked wrong" because it was 53 characters rather than the 39-character
`AIza` shape was incorrect — it lists 30 usable models.

### Verifying the demo without spending credits

Asking the demo for flights on a date in the past exercises the whole chain —
model picks the tool, tool validates, error streams back, model reads it and
replies — and costs nothing, because the validation runs before any request:

    "type":"tool-input-available"  "toolName":"flightsSearch"
    "type":"tool-output-available"
    "error":"outboundDate is in the past (2020-01-01). Today is 2026-09-16..."
    "type":"text-delta"   <- the model then answered using that error

Worth keeping as the smoke test whenever the demo is touched.

### Next tried to write its own CLAUDE.md

On first `next dev`, Next 16 generated `AGENTS.md` and `CLAUDE.md` inside
`examples/chat`. The repository's own `CLAUDE.md` at the root was untouched, but
the generated copies are noise, so `agentRules: false` is set in
`next.config.ts` and the files are deleted.

## Phase 6 — Docs, CI and review

- [x] Package README (npm page) — install, 3-line quick start, every tool's
      inputs and outputs, all options, the locale example, "why SerpApi",
      "not official" note
- [x] Root README with the AI-assisted development disclosure
- [x] "Not official SerpApi" note in both
- [x] `.github/workflows/ci.yml` — no secrets, Ubuntu + Windows, Node 20/22/24
- [x] Developer-advocate review pass
- [x] Commit

### What the review changed

1. **Six dead exports removed.** `DEFAULT_MAX_RESULTS`, `DEFAULT_TIMEOUT_MS`,
   `resolveApiKey`, `ISO_DATE_PATTERN` and `isBefore` were exported but never
   imported anywhere — each used only inside its own file. `SearchCache.size`
   was genuinely dead and is gone.
2. **One way to compare dates.** `validate.ts` had an `isBefore` helper while
   `flights.ts` and `hotels.ts` compared dates with raw `<=`. Both now use the
   helper, so the "ISO dates compare correctly as strings" reasoning lives in
   one place.
3. **India taken out of the published package.** The tool descriptions had
   India-specific examples baked in — Connaught Place, Jaipur, "rupee prices",
   a list of Indian airport codes. `CLAUDE.md` asks for the India example to be
   *documented, not hard-coded*, and those strings ship to every user of the
   package worldwide. Descriptions are now locale-neutral; India stays in the
   README, the `.env.example` and the demo, where it belongs.
4. **A CI bug caught before the first push.** `npm run typecheck` covers the
   examples, which import the package by name — so they cannot typecheck until
   `dist` exists. The workflow now builds first. A root `prepare` script also
   builds on `npm install`, so a fresh clone works immediately.

### Verified, not assumed

- `npm pack --dry-run` lists exactly `dist/`, `README.md`, `LICENSE`,
  `package.json` — 9 files, 76.6 kB packed.
- A scan of all 62 git-tracked files found neither API key, no `api_key=` with a
  value, and no `AIza`-shaped string. `.env` is not tracked.

## Phase 7 — npm preparation (do NOT publish)

- [x] Finished `package.json`: author, repository (with `directory`), homepage,
      bugs, 20 keywords, exports, types, files, engines, peerDependencies,
      sideEffects, `publishConfig.access`, and `prepublishOnly`
- [x] `npm pack --dry-run` — 9 files, 77.0 kB packed, 423.5 kB unpacked
- [x] Installed the tarball in a temp folder outside the repo; ESM and CJS both
      import, and the types resolve under both `node16` resolution modes
- [x] Manual publish commands written out (nothing published, no tokens made)
- [x] Commit

### The Node floor was wrong

`engines` said `>=20.0.0` and the README said "Node 18 or newer". Both are
wrong, because the package calls `AbortSignal.any()`, which the Node docs give
as **added in v20.3.0 and v18.17.0**. So `>=20.0.0` would admit Node 20.0–20.2,
which do not have it, and plain "Node 18" would admit 18.0–18.16, which do not
either.

Now `"node": "^18.17.0 || >=20.3.0"`, which is exactly right — and deliberately
excludes Node 19, which never got the backport. The README and the "no fetch
available" error message say 18.17 to match.

### What the tarball was actually checked for

Installed from the `.tgz` into a throwaway project outside the repository:

- `import` works, `require` works, and all six factories plus `serpApiTools()`
  are present in both
- `include: ["flights"]` still narrows at runtime
- **types resolve under both** `module: node16` as ESM *and* as CJS — this is the
  check that catches a broken dual-package `exports` map
- a real search runs against an injected `fetch` and returns compacted results
- the key reaches the request URL and appears nowhere in the output or `params`
- a past date is still rejected without a request being made

`prepublishOnly` was run directly: typecheck, 109 tests and build all pass, so a
broken build cannot be published by accident.

## Phase 8 — Hand-over

- [x] Plain-language summary
- [x] 5 judge questions with answers
- [x] Submission text — **244 words**, names all seven engines, includes the
      AI disclosure
- [x] Demo video script — 2 minutes 50, with timings and a cut-down plan
- [x] Commit

All of it lives in [HANDOVER.md](./HANDOVER.md), ready to copy from.

## Hard rules in force

1. Never open, print or commit `.env` or API keys.
2. The key must never appear in errors, logs, tool output or fixtures.
3. Never run `npm publish` or create tokens. The owner publishes manually.
4. Unit tests never call the real SerpApi.
5. Never spend real searches without asking, and always say how many.
6. Never `git push` — the owner pushes with GitHub Desktop.
