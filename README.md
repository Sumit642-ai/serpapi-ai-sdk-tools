# serpapi-ai-sdk-tools

**SerpApi search tools for the [Vercel AI SDK](https://ai-sdk.dev): web, news, maps,
shopping, flights and hotels.**

An entry for the **SerpApi India Hackathon 2026**, Open-Source Integrations track.

> **Not an official SerpApi package.** This is a community, open-source project, not
> affiliated with or endorsed by SerpApi.

---

## What this is

SerpApi ships an official Python package,
[`serpapi-search-tools`](https://github.com/serpapi/serpapi-search-tools-python), that
gives Python agent frameworks ready-made search tools. There is no TypeScript
equivalent — so anyone building on the Vercel AI SDK has to write the SerpApi
integration themselves: the fetch wrapper, the zod schemas, the response trimming, the
error handling, and the part where you make sure your API key never ends up in a model's
context window.

This package is that missing piece. Six tools, one line of setup:

```ts
import { streamText, stepCountIs } from "ai";
import { serpApiTools } from "serpapi-ai-sdk-tools";

const result = streamText({
  model: yourModel,
  messages,
  tools: serpApiTools(),
  stopWhen: stepCountIs(5),
});
```

📦 **[Full package documentation →](./packages/serpapi-ai-sdk-tools/README.md)**

## What makes it more than a fetch wrapper

- **Validation before you spend.** Flight and hotel dates, IATA codes and date ordering
  are all checked before a request goes out, so a model's mistake costs zero credits.
  The free SerpApi plan is 250 searches a month, and that adds up.
- **Errors a model can recover from.** Nothing throws. A bad input comes back as
  `{ error: "outboundDate is in the past (2020-01-01). Today is 2026-09-16..." }`, the
  model reads it, fixes the date and retries.
- **Compact results.** Raw SerpApi responses are large — the recorded Google Shopping
  fixture in this repo is 271 KB. Each tool returns five small objects with the fields
  that matter, so your context window survives a multi-step agent run.
- **The API key never leaves.** It is attached to the request URL and nowhere else. It
  is absent from results, from the echoed parameters, and from every error message,
  with redaction as a last line of defence. A dedicated test drives all six tools down
  every failure path and asserts the key appears in none of the output.
- **Nothing found is not an error.** A valid search that matched nothing returns
  `{ results: [], note: "No results found" }`, because reporting it as a failure makes
  models retry the same search forever.

## The demo

`examples/chat` is a Next.js chat app using the package exactly as a real application
would — imported by name through the workspace, consuming the built `dist`.

```powershell
git clone https://github.com/Sumit642-ai/serpapi-ai-sdk-tools
cd serpapi-ai-sdk-tools
npm install
Copy-Item .env.example .env   # then add your keys
npm run dev
```

Open <http://localhost:3000>. Every search shows a **tool activity line** naming the
tool, the SerpApi engine and the exact parameters sent, with results rendered as cards.

Try the buttons:

| Ask | Engine |
| --- | ------ |
| Flights from Delhi to Goa next Friday | `google_flights` |
| Cafes near Connaught Place | `google_maps` |
| Best budget earbuds prices in India | `google_shopping` |
| Latest ISRO news | `google_news` |
| Hotels in Jaipur this weekend | `google_hotels` |

The dated ones are deliberately vague — the model has to work out a real `YYYY-MM-DD`
date before the tools will accept it.

There is also `examples/basic`, a single script that asks one question and prints the
answer plus which searches ran.

## Keys

Two, both free, in one `.env` at the repository root:

| Variable | Needed for | Get one |
| -------- | ---------- | ------- |
| `SERPAPI_API_KEY` | everything | <https://serpapi.com/manage-api-key> |
| `GOOGLE_GENERATIVE_AI_API_KEY` | the chat demo only | <https://aistudio.google.com/apikey> |
| `DEMO_MODEL` | optional | defaults to `gemini-3.6-flash` |

`.env` is git-ignored. `.env.example` has placeholders only.

## Commands

| Command | What it does | Costs credits? |
| ------- | ------------ | -------------- |
| `npm test` | 109 tests against recorded fixtures | No — no network at all |
| `npm run typecheck` | every workspace | No |
| `npm run build` | ESM + CJS + `.d.ts` | No |
| `npm run dev` | the chat demo | Only when you ask it something |
| `npm run example:basic` | the one-file example | 1–2 per run |
| `npm run fixtures` | re-record fixtures from real searches | **Yes — 6, one per engine** |

`npm run fixtures -- news` re-records a single engine for one credit.

## Layout

```
packages/serpapi-ai-sdk-tools/   the published package
  src/client.ts                  fetch wrapper: URL, key, timeout, abort, errors, cache
  src/tools/                     the six AI SDK tools
  src/compact/                   raw SerpApi JSON to small predictable objects
  test/                          109 tests, recorded fixtures, mocked fetch
examples/basic/                  one script, one question
examples/chat/                   Next.js demo used for the video
scripts/record-fixtures.ts       real searches to cleaned fixtures
```

## Testing

Tests never touch the network. They run against real SerpApi responses recorded once by
`scripts/record-fixtures.ts`, served through a mocked `fetch`.

Recorded fixtures are checked for structure rather than content — asserting a specific
hotel name would break the suite every time anyone re-records. Branches that real data
happens not to cover are tested against small inline responses: every recorded flight is
non-stop, so connecting itineraries, layovers and airline de-duplication are exercised
with hand-built input instead.

The recorder scrubs every response before writing, and refuses to save a file if a
credential survives. A test asserts the committed fixtures contain no key.

## AI-assisted development disclosure

**This project was built with heavy AI assistance, and it would be dishonest to present
it otherwise.**

I used **Claude Code (Opus 5)** as a pair programmer for essentially all of it:
designing the package, writing the TypeScript, writing the tests, building the demo, and
writing this documentation. I directed the work, made the decisions, supplied the API
keys, ran the commands and verified the results in the browser myself.

Specific things worth naming, because "AI wrote it" can hide real engineering decisions:

- The AI SDK v7 API was verified against the installed `.d.ts` files rather than from
  the model's memory. That caught two things the documentation prose got wrong, and
  caught that `system:` is now deprecated in favour of `instructions:`.
- TypeScript is pinned to 5.9.3 because 6 and 7 both break `tsup`'s `.d.ts` generation.
  That was found by trying them, not assumed.
- The demo model is `gemini-3.6-flash` because the originally planned `gemini-3.8-flash`
  times out. That was found by measuring time-to-first-token across six models.
- Fourteen tests failed the first time they ran against real recorded SerpApi data.
  None were bugs in the package — all were assertions written against invented fixture
  content — and fixing them properly meant rewriting the tests to check structure.

Every one of those was a case of the plan being wrong and reality correcting it. The
code is AI-written; the verification is real.

## License

MIT © Sumit642-ai — see [LICENSE](./LICENSE).

SerpApi is a trademark of SerpApi, LLC. This project is not affiliated with SerpApi.
