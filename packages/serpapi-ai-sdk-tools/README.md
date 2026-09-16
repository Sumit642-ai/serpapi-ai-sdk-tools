# serpapi-ai-sdk-tools

Ready-made [SerpApi](https://serpapi.com) search tools for the
[Vercel AI SDK](https://ai-sdk.dev): **web, news, maps, shopping, flights and hotels**.

Give a model live Google results in three lines, with typed inputs that are checked
before a request is sent and compact results that do not flood your context window.

> **Not an official SerpApi package.** This is a community, open-source project. It is
> not affiliated with, endorsed by, or maintained by SerpApi. It is the TypeScript
> counterpart of SerpApi's official Python package
> [`serpapi-search-tools`](https://github.com/serpapi/serpapi-search-tools-python),
> which supports Python agent frameworks only.

---

## Install

```bash
npm install serpapi-ai-sdk-tools ai zod
```

`ai` and `zod` are peer dependencies — you almost certainly have them already. The
package itself has **no runtime dependencies** and calls SerpApi with the built-in
`fetch`.

**Node 18.17 or newer** (or 20.3+). That floor is set by `AbortSignal.any()`, which the
package uses to honour the AI SDK's `abortSignal` alongside its own timeout.

Then set your key. A free SerpApi plan gives you 250 searches a month:

```bash
# .env
SERPAPI_API_KEY=your_key_from_serpapi.com/manage-api-key
```

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import { serpApiTools } from "serpapi-ai-sdk-tools";

const { text } = await generateText({
  model: yourModel,
  prompt: "What are the cheapest flights from London to Lisbon next month?",
  tools: serpApiTools(),
  stopWhen: stepCountIs(5),
});
```

That is the whole integration. `serpApiTools()` reads `SERPAPI_API_KEY` from the
environment and returns all six tools, ready to pass to `generateText`, `streamText`
or an `Agent`.

Need only some of them? Ask for the ones you want — the return type narrows to match,
so `tools.flightsSearch` exists and `tools.webSearch` does not:

```ts
const tools = serpApiTools({ include: ["flights", "hotels"] });
```

---

## The six tools

Each one is also exported on its own, so you can configure them separately:

```ts
import { webSearch, newsSearch, mapsSearch,
         shoppingSearch, flightsSearch, hotelsSearch } from "serpapi-ai-sdk-tools";
```

The names deliberately echo SerpApi's Python package, so `webSearch` here is
`web_search` there.

| Tool | SerpApi engine | Use it for |
| ---- | -------------- | ---------- |
| `webSearch` | `google_light` (or `google`) | facts, documentation, anything needing a current page |
| `newsSearch` | `google_news` | recent articles and events |
| `mapsSearch` | `google_maps` | places, businesses, "near me" questions |
| `shoppingSearch` | `google_shopping` | product prices and comparisons |
| `flightsSearch` | `google_flights` | real flight prices and itineraries |
| `hotelsSearch` | `google_hotels` | hotels and vacation rentals |

### `webSearch`

**Inputs:** `query` (required), `country`, `language`

**Returns:** `WebResult[]` — `position`, `title`, `link`, `snippet`, `source`, `date`

Defaults to SerpApi's `google_light` engine, which returns organic results only and is
noticeably faster — what an agent loop wants. Pass `engine: "google"` for the full
Google page if you need its exact ranking.

```ts
webSearch({ engine: "google" });
```

### `newsSearch`

**Inputs:** `query` (required), `country`, `language`

**Returns:** `NewsResult[]` — `position`, `title`, `link`, `source`, `date`, `isoDate`, `snippet`

Both a human-readable `date` and a machine-readable `isoDate` are returned, because
models reason about timestamps far better than about `"3 hours ago"`.

### `mapsSearch`

**Inputs:** `query` (required), `latitude`, `longitude`, `country`, `language`

**Returns:** `MapsResult[]` — `position`, `title`, `address`, `type`, `rating`,
`reviews`, `price`, `phone`, `website`, `openState`, `latitude`, `longitude`

Send `latitude` and `longitude` together to search around a point; they are ignored
unless both are present. Google Maps has no `location` parameter, so a configured
`defaults.location` is folded into the query text instead.

### `shoppingSearch`

**Inputs:** `query` (required), `country`, `language`, `minPrice`, `maxPrice`

**Returns:** `ShoppingResult[]` — `position`, `title`, `price`, `extractedPrice`,
`link`, `source`, `rating`, `reviews`, `delivery`, `snippet`, `thumbnail`

Prices come back twice on purpose: `price` is the display string with its currency
symbol (`"₹1,299"`), and `extractedPrice` is the number (`1299`), so a model can answer
"which is cheapest" without parsing text.

Note that Google Shopping has **no currency parameter** — the store front decides the
currency, so use `country` / `defaults.gl` to control it.

### `flightsSearch`

**Inputs:** `departureId`, `arrivalId`, `outboundDate` (all required), `returnDate`,
`adults`, `travelClass`, `currency`

**Returns:** `FlightResult[]` — `price`, `category` (`"best"` or `"other"`),
`totalDurationMinutes`, `airlines`, `flightNumbers`, `departure`, `arrival`, `stops`,
`layovers`, `travelClass`, `carbonEmissionsGrams`

Airports are 3-letter IATA codes, accepted in either case. Dates are `YYYY-MM-DD` and
must not be in the past.

**You never set the trip type.** Google Flights requires a return date for a round trip
and forbids one for a one-way, so the type is derived from whether you gave a
`returnDate`. Leave it out for one-way.

A multi-leg journey is flattened into one itinerary: `departure` is the first leg's
origin, `arrival` is the last leg's destination, and `stops` is the number of legs
minus one.

### `hotelsSearch`

**Inputs:** `query`, `checkInDate`, `checkOutDate` (all required), `adults`,
`currency`, `country`

**Returns:** `HotelResult[]` — `name`, `type`, `ratePerNight`, `extractedRatePerNight`,
`totalRate`, `overallRating`, `reviews`, `hotelClass`, `amenities`, `link`,
`checkInTime`, `checkOutTime`, `latitude`, `longitude`, `thumbnail`

Check-out must be after check-in. Amenities are capped at six, because a single
property can list thirty and would otherwise dominate the whole response.

---

## What a tool returns

Every tool resolves to one of three shapes. **None of them throw**, so a bad search
never breaks your run.

**Results:**

```jsonc
{
  "engine": "google_flights",
  "params": { "departure_id": "LHR", "arrival_id": "LIS", "outbound_date": "2026-10-16" },
  "results": [ /* … */ ]
}
```

**Nothing found** — a normal answer, not a failure:

```jsonc
{ "engine": "google_light", "params": { "q": "…" }, "results": [], "note": "No results found" }
```

**Something went wrong** — a sentence the model can act on:

```jsonc
{ "error": "outboundDate is in the past (2020-01-01). Today is 2026-09-16. Use today or a later date." }
```

That last shape is the point of the design. Returning a readable error instead of
throwing lets the model fix its own mistake and try again, rather than failing the
whole generation. Inputs are checked **before** any request goes out, so a mistake
costs you nothing.

`params` always tells you exactly what was sent, and **never contains your API key**.

---

## Options

Every tool factory, and `serpApiTools()`, accepts the same options:

| Option | Default | What it does |
| ------ | ------- | ------------ |
| `apiKey` | `SERPAPI_API_KEY`, then `SERPAPI_KEY` | Your SerpApi key. Prefer the environment. |
| `defaults` | `{}` | `{ gl, hl, location, currency }` applied to every search. |
| `maxResults` | `5` | How many results to keep per search. |
| `timeoutMs` | `30000` | Request timeout. |
| `cache` | `false` | `{ ttlMs, maxEntries? }` to cache responses in memory. |
| `fetch` | global `fetch` | Inject your own, mainly for tests. |
| `include` | all six | `serpApiTools()` only. Which tools to build. |
| `engine` | `"google_light"` | `webSearch` only. `"google_light"` or `"google"`. |

A tool call can always override `defaults` — if the model sends `country`, that wins.

### Saving credits with the cache

The free plan is 250 searches a month, and agents repeat themselves more than you would
expect — a retry, a second step re-checking a fact, two users asking about the same
city. An in-memory cache turns those into zero-cost lookups:

```ts
serpApiTools({ cache: { ttlMs: 5 * 60 * 1000 } });
```

It is off by default. Each tool keeps its own cache, which costs nothing, since two
different engines would never share an entry anyway. The key never forms part of a
cache key.

### Cancellation

The `abortSignal` the AI SDK passes into `execute` is honoured. If the surrounding
generation is cancelled, the in-flight SerpApi request is dropped with it — and a
search that is cancelled before it starts never spends a credit at all.

---

## Using it from India (or anywhere)

Nothing about the package is region-specific. Point it wherever you need with
`defaults`:

```ts
const tools = serpApiTools({
  defaults: { gl: "in", hl: "en", currency: "INR" },
  maxResults: 5,
});
```

- `gl` — two-letter country, decides ranking and which shops appear
- `hl` — language for the results
- `location` — a city-level string like `"Bengaluru, Karnataka, India"`
- `currency` — three-letter code, used by flights and hotels

Swap in `{ gl: "de", hl: "de", currency: "EUR" }` and everything works the same.

---

## Types

All result types are exported, so you can type your own UI against them:

```ts
import type {
  WebResult, NewsResult, MapsResult,
  ShoppingResult, FlightResult, HotelResult,
  ToolResult, SerpApiToolOptions,
} from "serpapi-ai-sdk-tools";
```

---

## Why SerpApi

Scraping Google yourself means proxies, CAPTCHAs, rotating user agents, and markup that
changes without warning — and it breaks on a Friday evening. SerpApi handles all of
that and returns structured JSON with a real SLA.

What it gives an AI application specifically:

- **Live data.** A model's training has a cutoff. Prices, flights, hotel availability
  and today's news do not exist inside it at any size.
- **Real prices and real availability**, not a plausible-looking guess. For flights and
  hotels, a hallucinated number is worse than no answer.
- **Many engines, one shape.** Google, News, Maps, Shopping, Flights and Hotels all
  answer through the same API, which is what makes six tools out of one integration
  practical.
- **Someone else maintains the parsers.** When Google changes its markup, that is
  SerpApi's problem rather than yours.

This package adds the layer between SerpApi and the AI SDK: typed inputs validated
before you spend a credit, compact token-efficient results, errors a model can recover
from, and your key kept out of every output.

---

## Contributing and development

```bash
git clone https://github.com/Sumit642-ai/serpapi-ai-sdk-tools
cd serpapi-ai-sdk-tools
npm install
npm test          # no network — runs against recorded fixtures
npm run typecheck
npm run build
```

Tests never call the real SerpApi. They use recorded responses and a mocked `fetch`, so
the suite costs nothing to run and works offline. See the
[repository README](https://github.com/Sumit642-ai/serpapi-ai-sdk-tools) for the demo
app and for how fixtures are recorded.

## License

MIT © Sumit642-ai
