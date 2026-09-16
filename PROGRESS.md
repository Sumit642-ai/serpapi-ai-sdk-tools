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
- [ ] Owner approves the plan  ← **waiting here**

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

- [ ] `client.ts` — URL building, key resolution, timeout, abort, errors, cache
- [ ] Six tools: web, news, maps, shopping, flights, hotels
- [ ] Compaction functions
- [ ] `serpApiTools()` with the `include` option
- [ ] Optional in-memory cache
- [ ] Tests: validation, compaction, empty results, errors, missing key,
      key-never-leaked, cache, abort
- [ ] `npm test`, `npm run typecheck`, `npm run build` pass
- [ ] Commit

## Phase 4 — Real fixtures (CHECKPOINT)

- [ ] `scripts/record-fixtures.ts`
- [ ] **STOP** — give the owner the `.env` command and the exact search count
- [ ] Owner says "done, go ahead"
- [ ] Record, verify fixtures carry no secrets, switch tests over, all pass
- [ ] Commit

## Phase 5 — Examples and demo (CHECKPOINT)

- [ ] `examples/basic`
- [ ] `examples/chat` Next.js demo: result cards, tool activity line, prompt buttons
- [ ] Package imported through the workspace, not relative `src` paths
- [ ] `npm run dev` starts it
- [ ] **STOP** — give the owner 6 browser questions to try
- [ ] Fix whatever the owner reports
- [ ] Commit

## Phase 6 — Docs, CI and review

- [ ] Package README (npm page)
- [ ] Root README with the AI-assisted development disclosure
- [ ] "Not official SerpApi" note in both
- [ ] `.github/workflows/ci.yml` (no secrets)
- [ ] Developer-advocate review pass; list the changes
- [ ] Commit

## Phase 7 — npm preparation (do NOT publish)

- [ ] Finish `package.json` metadata
- [ ] `npm pack --dry-run` file list and size
- [ ] Install the tarball in a temp folder outside the repo; ESM + CJS import check
- [ ] Write out the manual publish commands
- [ ] Commit

## Phase 8 — Hand-over

- [ ] Plain-language summary
- [ ] 5 judge questions with answers
- [ ] Submission text under 250 words
- [ ] Demo video script under 3 minutes

## Hard rules in force

1. Never open, print or commit `.env` or API keys.
2. The key must never appear in errors, logs, tool output or fixtures.
3. Never run `npm publish` or create tokens. The owner publishes manually.
4. Unit tests never call the real SerpApi.
5. Never spend real searches without asking, and always say how many.
6. Never `git push` — the owner pushes with GitHub Desktop.
