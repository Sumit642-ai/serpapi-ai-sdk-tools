import type {
  FlightResult,
  HotelResult,
  MapsResult,
  NewsResult,
  ShoppingResult,
  WebResult,
} from "serpapi-ai-sdk-tools";

/**
 * Renders a tool's results as cards.
 *
 * The types here are imported from the package itself, so if a compact result
 * ever changes shape this file stops compiling. That is the point — the demo is
 * also a type-level test that the published types are usable.
 */

export interface ToolSuccess {
  engine: string;
  params: Record<string, string>;
  results: unknown[];
  note?: string;
}

export interface ToolFailure {
  error: string;
}

export type ToolOutput = ToolSuccess | ToolFailure;

/** Tool output arrives from the stream as `unknown`, so it is checked here. */
export function readToolOutput(output: unknown): ToolOutput | undefined {
  if (typeof output !== "object" || output === null) return undefined;

  if ("error" in output && typeof (output as ToolFailure).error === "string") {
    return output as ToolFailure;
  }

  if ("results" in output && Array.isArray((output as ToolSuccess).results)) {
    return output as ToolSuccess;
  }

  return undefined;
}

export function isFailure(output: ToolOutput): output is ToolFailure {
  return "error" in output;
}

/** "155" -> "2h 35m". Minutes alone are hard to compare at a glance. */
function formatDuration(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}m` : `${hours}h ${rest}m`;
}

/**
 * Formats a flight price, which arrives as a bare number plus a currency code.
 * Shopping and hotel prices already come as display strings and skip this.
 */
function formatPrice(amount: number | undefined, currency: string | undefined): string | undefined {
  if (amount === undefined) return undefined;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency ?? "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // An unknown currency code would throw; showing the number still helps.
    return `${amount.toLocaleString("en-IN")} ${currency ?? ""}`.trim();
  }
}

function Rating({ rating, reviews }: { rating?: number; reviews?: number }) {
  if (rating === undefined) return null;
  return (
    <span>
      ★ {rating.toFixed(1)}
      {reviews !== undefined ? ` (${reviews.toLocaleString("en-IN")})` : ""}
    </span>
  );
}

function WebCards({ results }: { results: WebResult[] }) {
  return (
    <div className="cards">
      {results.map((item, index) => (
        <div className="card" key={`${item.link ?? item.title}-${index}`}>
          <div className="card-body">
            <p className="card-title">
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </p>
            <div className="card-meta">
              {item.source ? <span>{item.source}</span> : null}
              {item.date ? <span>{item.date}</span> : null}
            </div>
            {item.snippet ? <p className="card-snippet">{item.snippet}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsCards({ results }: { results: NewsResult[] }) {
  return (
    <div className="cards">
      {results.map((item, index) => (
        <div className="card" key={`${item.link ?? item.title}-${index}`}>
          <div className="card-body">
            <p className="card-title">
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </p>
            <div className="card-meta">
              {item.source ? <span>{item.source}</span> : null}
              {item.date ? <span>{item.date}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapsCards({ results }: { results: MapsResult[] }) {
  return (
    <div className="cards">
      {results.map((item, index) => (
        <div className="card" key={`${item.title}-${index}`}>
          <div className="card-body">
            <p className="card-title">
              {item.website ? (
                <a href={item.website} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </p>
            <div className="card-meta">
              <Rating rating={item.rating} reviews={item.reviews} />
              {item.type ? <span>{item.type}</span> : null}
              {item.price ? <span>{item.price}</span> : null}
              {item.openState ? <span>{item.openState}</span> : null}
            </div>
            {item.address ? <p className="card-snippet">{item.address}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShoppingCards({ results }: { results: ShoppingResult[] }) {
  return (
    <div className="cards">
      {results.map((item, index) => (
        <div className="card" key={`${item.link ?? item.title}-${index}`}>
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- product images
            // come from many Google CDN hosts, which next/image would each need
            // configuring for. A plain img keeps the demo simple.
            <img className="thumb" src={item.thumbnail} alt="" />
          ) : null}
          <div className="card-body">
            <p className="card-title">
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </p>
            <div className="card-meta">
              {item.source ? <span>{item.source}</span> : null}
              <Rating rating={item.rating} reviews={item.reviews} />
              {item.delivery ? <span>{item.delivery}</span> : null}
            </div>
          </div>
          {item.price ? <div className="card-price">{item.price}</div> : null}
        </div>
      ))}
    </div>
  );
}

function FlightCards({ results, currency }: { results: FlightResult[]; currency?: string }) {
  return (
    <div className="cards">
      {results.map((item, index) => (
        <div className="card" key={`${item.flightNumbers?.join("-") ?? index}`}>
          <div className="card-body">
            <p className="card-title">
              <span className="route">
                {item.departure.id} → {item.arrival.id}
              </span>{" "}
              {item.airlines.join(", ")}
            </p>
            <div className="card-meta">
              <span>{formatDuration(item.totalDurationMinutes)}</span>
              <span>{item.stops === 0 ? "Non-stop" : `${item.stops} stop`}</span>
              {item.departure.time ? <span>Departs {item.departure.time}</span> : null}
              {item.flightNumbers ? <span>{item.flightNumbers.join(" · ")}</span> : null}
            </div>
          </div>
          <div className="card-price">{formatPrice(item.price, currency)}</div>
        </div>
      ))}
    </div>
  );
}

function HotelCards({ results }: { results: HotelResult[] }) {
  return (
    <div className="cards">
      {results.map((item, index) => (
        <div className="card" key={`${item.name}-${index}`}>
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img className="thumb" src={item.thumbnail} alt="" />
          ) : null}
          <div className="card-body">
            <p className="card-title">
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer">
                  {item.name}
                </a>
              ) : (
                item.name
              )}
            </p>
            <div className="card-meta">
              <Rating rating={item.overallRating} reviews={item.reviews} />
              {item.hotelClass ? <span>{item.hotelClass}-star</span> : null}
              {item.type ? <span>{item.type}</span> : null}
            </div>
            {item.amenities ? (
              <p className="card-snippet">{item.amenities.slice(0, 4).join(" · ")}</p>
            ) : null}
          </div>
          {item.ratePerNight ? (
            <div className="card-price">
              {item.ratePerNight}
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>per night</div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Picks the right card layout for whichever tool produced the results. */
export function ResultCards({ toolName, output }: { toolName: string; output: ToolSuccess }) {
  if (output.results.length === 0) {
    return <p className="note">{output.note ?? "No results found"}</p>;
  }

  switch (toolName) {
    case "webSearch":
      return <WebCards results={output.results as WebResult[]} />;
    case "newsSearch":
      return <NewsCards results={output.results as NewsResult[]} />;
    case "mapsSearch":
      return <MapsCards results={output.results as MapsResult[]} />;
    case "shoppingSearch":
      return <ShoppingCards results={output.results as ShoppingResult[]} />;
    case "flightsSearch":
      return (
        <FlightCards
          results={output.results as FlightResult[]}
          currency={output.params["currency"]}
        />
      );
    case "hotelsSearch":
      return <HotelCards results={output.results as HotelResult[]} />;
    default:
      return null;
  }
}
