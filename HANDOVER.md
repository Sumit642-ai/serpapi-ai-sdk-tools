# Hand-over

Everything you need to submit, demo and talk about this project.

- **Repo:** https://github.com/Sumit642-ai/serpapi-ai-sdk-tools
- **npm name:** `serpapi-ai-sdk-tools` (prepared, **not published** — see
  [PROGRESS.md](./PROGRESS.md) for the publish commands)
- **Deadline:** 5 October 2026, 23:59 IST

---

## 1. What was built, in plain language

SerpApi already gives Python developers a ready-made set of search tools
(`serpapi-search-tools`). Nothing like it existed for TypeScript, so anyone building
on the Vercel AI SDK had to write the whole SerpApi integration themselves every
time.

**This package is that missing piece.** It gives an AI model six search abilities in
one line of code:

```ts
tools: serpApiTools()
```

That one line covers web search, news, maps, shopping, flights and hotels. The model
decides which to use and when.

### What is in the box

| Piece | What it is |
| ----- | ---------- |
| `packages/serpapi-ai-sdk-tools/` | The package itself. Six tools, no runtime dependencies. |
| `examples/chat/` | A Next.js chat app — the demo you record. |
| `examples/basic/` | One small script: ask a question, print the answer. |
| `scripts/record-fixtures.ts` | Records real SerpApi responses so tests never need the network. |
| `.github/workflows/ci.yml` | Runs on Ubuntu and Windows, Node 20/22/24, no secrets. |

### How to run it

```powershell
cd D:\serp-api-hackathon\serpapi-ai-sdk-tools
npm install
npm run dev
```

Open <http://localhost:3000> and click a prompt button.

| Command | What it does | Costs SerpApi credits? |
| ------- | ------------ | ---------------------- |
| `npm test` | 109 tests | No — never touches the network |
| `npm run typecheck` | every workspace | No |
| `npm run build` | ESM + CJS + types | No |
| `npm run dev` | the chat demo | Only when you ask it something |
| `npm run fixtures` | re-record fixtures | **Yes — 6** |

Your keys live in one `.env` at the repo root. It is git-ignored.

---

## 2. Five questions a judge might ask

### "Isn't this just a wrapper around `fetch`?"

No — a `fetch` call is about four lines of it. The work is everything around that:

- **Validation before spending.** Dates, IATA codes and date ordering are checked
  before any request. A model sending "next Friday" or a past date costs **zero**
  credits. On a 250-search free plan that is real money.
- **Errors a model can recover from.** Nothing throws. A mistake comes back as
  `{ error: "outboundDate is in the past (2020-01-01). Today is 2026-09-16..." }`.
  The model reads that, fixes the date and retries by itself.
- **Compaction.** The real Google Shopping response in this repo is **271 KB**. The
  tool returns five small objects. Without that, two searches would blow a context
  window.
- **Key safety.** The key is on the request URL and nowhere else.

### "How do I know the API key is safe?"

Three layers, and a test that proves it:

1. It is only ever attached to the request URL, and that URL object never leaves the
   function.
2. The parameters echoed back to the model are built without it, so it cannot appear
   in tool output.
3. Every error message is passed through a redactor that strips the key and anything
   shaped like `api_key=`.

`test/no-key-leak.test.ts` drives **all six tools down every failure path** — SerpApi
error, HTTP error, network failure, timeout, and an error that quotes our own URL back
at us — and asserts the key appears in none of the output. A separate test checks the
committed fixtures contain no key, and a scan of every git-tracked file found neither
key, no `api_key=` carrying a value, and no `AIza`-shaped string.

### "Do your tests actually test anything, or do they just mock everything?"

They run against **real SerpApi responses**, recorded once by
`scripts/record-fixtures.ts` and served through a mocked `fetch`. So they exercise real
data shapes but cost nothing and work offline.

That distinction is not theoretical. When the recorded data first replaced my
handwritten fixtures, **14 tests failed** — all of them assertions I had written
against invented data. Fixing them properly meant rewriting the tests to check
structure rather than content, so they do not break every time anyone re-records.

Real data also does not cover every branch: all nine recorded flights happen to be
non-stop. So connecting flights, layovers and airline de-duplication are tested against
small hand-written inputs, visible in the test file.

### "What was the hardest part?"

Google Flights. It rejects a round-trip search with no return date **and** rejects a
one-way search that has one — so `type` and `return_date` have to agree or the search
fails. Rather than ask the model to get that right, the tool derives the trip type from
whether a return date was given, which makes it impossible to get wrong.

The wider lesson: most of the engineering is in the differences between engines.
`google_light` has no `num` parameter. `google_maps` has no `location` parameter.
`google_shopping` has no `currency` parameter. Each was checked against the docs rather
than assumed.

### "How much of this did AI write?"

Most of the code. I used Claude Code (Opus 5) as a pair programmer throughout, and the
README says so plainly.

What that hides, and what I would point to: the plan was wrong repeatedly and reality
corrected it. TypeScript 7 broke the build tooling, so it is pinned to 5.9.3. The
planned demo model, `gemini-3.8-flash`, times out — I measured six models and switched
to `gemini-3.6-flash` at 2.1s. The AI SDK docs prose was wrong about two APIs, so I
verified against the installed `.d.ts` files instead. The `engines` field claimed Node
20 when `AbortSignal.any()` actually needs 20.3. **The code is AI-written; the
verification is real.**

---

## 3. Submission text

> **serpapi-ai-sdk-tools — SerpApi search tools for the Vercel AI SDK**
>
> SerpApi's official `serpapi-search-tools` package serves Python agent frameworks.
> There was no TypeScript equivalent, so Vercel AI SDK developers wrote it themselves.
> This is that missing piece: six ready-made tools in one line — `tools: serpApiTools()`.
>
> It wraps seven engines: `google_light` (default for web search, faster than the full
> page), `google`, `google_news`, `google_maps`, `google_shopping`, `google_flights`
> and `google_hotels`.
>
> More than a fetch wrapper:
>
> **Validation before spending.** IATA codes, date formats, check-out after check-in,
> no past dates — all checked before a request is sent, so a model's mistake costs zero
> credits, which matters on a 250-search free plan.
>
> **Errors a model recovers from.** Nothing throws. A bad input returns a readable
> sentence the model reads, fixes and retries.
>
> **Compact results.** A 271 KB Google Shopping response becomes five small objects, so
> context windows survive multi-step agent runs.
>
> **The key never leaves.** Absent from results, echoed parameters and every error, with
> a test driving all six tools down every failure path.
>
> 109 tests run offline against recorded fixtures. CI covers Ubuntu and Windows on Node
> 20/22/24 with no secrets. A Next.js demo shows every engine live, labelling the engine
> and parameters behind each search. MIT licensed. Not an official SerpApi package.
>
> **AI disclosure:** built with Claude Code (Opus 5) as a pair programmer — design,
> code, tests, demo, docs. I directed the work, made the decisions, supplied the keys,
> ran every command and verified the results myself.

---

## 4. Demo video script (2 minutes 50)

Record at 1280×720 or larger. Browser zoom ~110% so text is readable. Have the demo
already running and the page loaded before you hit record.

### 0:00–0:20 — The problem

> "SerpApi has an official package that gives Python agents ready-made search tools.
> If you build in TypeScript with the Vercel AI SDK, there isn't one — you write the
> whole integration yourself, every time. So I built it."

**Show:** the GitHub repo README, top section.

### 0:20–0:35 — The one line

> "Six tools. One line. That's the whole integration."

**Show:** `examples/chat/app/api/chat/route.ts`, highlight `tools: serpApiTools()`.

### 0:35–1:10 — Flights (the strongest demo)

> "I'll ask for flights from Delhi to Goa next Friday. Notice I never said a date."

**Show:** click **Flights from Delhi to Goa next Friday**. Let it run.

> "The model worked out the real date, called `flightsSearch`, and SerpApi's
> `google_flights` engine answered. This line shows exactly which engine ran and what
> was sent — real prices, real airlines, real durations."

**Show:** point at the tool activity line, then the cards.

### 1:10–1:40 — Two more engines

> "Same app, different engines."

**Show:** click **Hotels in Jaipur this weekend** — point out `google_hotels`, photos,
per-night prices. Then **Best budget earbuds prices in India** — point out
`google_shopping` and the product images.

### 1:40–2:00 — Maps and news, quickly

> "Maps and news too — six engines, one package."

**Show:** click **Cafes near Connaught Place**, then **Latest ISRO news**. Do not wait
for either to finish; keep moving.

### 2:00–2:25 — The part that isn't a fetch wrapper

> "Watch this. I'll ask for a flight in the past."

**Show:** type `Flights from Delhi to Goa on 2020-01-01`.

> "It doesn't crash, and it doesn't waste a search. Inputs are validated before any
> request goes out, so the model gets a sentence it can act on — and on a 250-search
> free plan, a mistake costing nothing actually matters."

**Show:** the red activity line and the error message.

### 2:25–2:45 — Trust

> "109 tests, and they never touch the network — they run against real SerpApi
> responses recorded once. CI runs on Ubuntu and Windows with no secrets. And there's a
> test that drives all six tools through every failure path to prove the API key never
> reaches the model."

**Show:** `npm test` output, then scroll `test/no-key-leak.test.ts`.

### 2:45–2:50 — Close

> "serpapi-ai-sdk-tools. MIT licensed, on GitHub. Not an official SerpApi package —
> just the TypeScript half of one that should exist."

**Show:** the repo page.

### If you need to cut

Drop **1:40–2:00** (maps and news) first — the activity line already proved the pattern.
Never cut 2:00–2:25; the validation demo is the most convincing thirty seconds.

### Recording tips

- Ask each question **once before recording** so it is cached — the demo caches for five
  minutes, so your take will be instant and you will not spend credits on retakes.
- Budget about 6 searches for a full rehearsal plus the real take.
