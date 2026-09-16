import { describe, expect, it } from "vitest";

import { compactFlights } from "../src/compact/flights.js";
import { compactHotels } from "../src/compact/hotels.js";
import { compactMaps } from "../src/compact/maps.js";
import { compactNews } from "../src/compact/news.js";
import { compactShopping } from "../src/compact/shopping.js";
import { compactWeb } from "../src/compact/web.js";

import flightsFixture from "./fixtures/flights.json";
import hotelsFixture from "./fixtures/hotels.json";
import mapsFixture from "./fixtures/maps.json";
import newsFixture from "./fixtures/news.json";
import shoppingFixture from "./fixtures/shopping.json";
import webFixture from "./fixtures/web.json";

/**
 * How these tests are split, and why.
 *
 * The fixtures are real SerpApi responses recorded by `npm run fixtures`.
 * Asserting on their *content* — a hotel's name, a flight's price — would mean
 * the suite breaks every time anyone re-records, which trains people to update
 * expectations without reading them. So the fixture tests below check
 * structure: the right number of results, the right fields, the right types,
 * and that raw SerpApi metadata was dropped.
 *
 * Specific branches are tested separately against tiny inline responses, where
 * the input is visible in the test. That matters because real data does not
 * cover every branch: the recorded flights happen to all be non-stop, and the
 * recorded news happens to have no grouped stories.
 */

const asData = (fixture: unknown) => fixture as Record<string, unknown>;

/** Fields SerpApi sends that must never survive into a compact result. */
function expectNoRawFields(results: unknown, forbidden: string[]): void {
  const serialised = JSON.stringify(results);
  for (const field of forbidden) {
    expect(serialised, `compact output still contains "${field}"`).not.toContain(field);
  }
}

describe("compactWeb (real response)", () => {
  const results = compactWeb(asData(webFixture), 5);

  it("trims to maxResults", () => {
    // The recorded response has more organic results than we keep.
    expect(asData(webFixture)["organic_results"]).toHaveLength(8);
    expect(results).toHaveLength(5);
  });

  it("gives every result a title, and a usable link", () => {
    for (const result of results) {
      expect(typeof result.title).toBe("string");
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.link).toMatch(/^https?:\/\//);
    }
  });

  it("keeps the snippet and the readable domain", () => {
    const first = results[0];
    expect(typeof first?.snippet).toBe("string");
    expect(typeof first?.source).toBe("string");
  });

  it("drops sitelinks, pagination and search metadata", () => {
    expectNoRawFields(results, ["sitelinks", "serpapi_pagination", "search_metadata", "displayed_link"]);
  });

  it("returns an empty list when there are no organic results", () => {
    expect(compactWeb({}, 5)).toEqual([]);
  });
});

describe("compactNews (real response)", () => {
  const results = compactNews(asData(newsFixture), 5);

  it("trims to maxResults", () => {
    expect(results).toHaveLength(5);
  });

  it("flattens the publisher object down to its name", () => {
    // SerpApi sends { name, icon, authors }; a model only needs the name.
    for (const result of results) {
      expect(typeof result.source).toBe("string");
    }
    expectNoRawFields(results, ["icon", "authors", "thumbnail_small"]);
  });

  it("keeps both the human date and the machine timestamp", () => {
    const first = results[0];
    expect(typeof first?.date).toBe("string");
    expect(first?.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("compactNews (grouped stories)", () => {
  // Google News sometimes returns a heading entry whose real articles sit in a
  // nested `stories` array. The recorded fixture has none, so this branch is
  // covered with a hand-built response instead.
  const grouped = {
    news_results: [
      {
        position: 1,
        title: "A normal article",
        source: { name: "The Hindu" },
        link: "https://example.com/a",
      },
      {
        position: 2,
        title: "Coverage heading that is not itself an article",
        stories: [
          { title: "First real story", source: { name: "Mint" }, link: "https://example.com/b" },
          { title: "Second real story", source: "Reuters", link: "https://example.com/c" },
        ],
      },
    ],
  };

  it("replaces the heading with the stories underneath it", () => {
    const results = compactNews(grouped, 10);

    expect(results.map((item) => item.title)).toEqual([
      "A normal article",
      "First real story",
      "Second real story",
    ]);
  });

  it("reads a publisher given as a plain string as well as an object", () => {
    const results = compactNews(grouped, 10);

    expect(results[1]?.source).toBe("Mint");
    expect(results[2]?.source).toBe("Reuters");
  });
});

describe("compactMaps (real response)", () => {
  const results = compactMaps(asData(mapsFixture), 5);

  it("trims to maxResults", () => {
    expect(results).toHaveLength(5);
  });

  it("gives every place a title and flattens its coordinates", () => {
    for (const result of results) {
      expect(typeof result.title).toBe("string");
      expect(typeof result.latitude).toBe("number");
      expect(typeof result.longitude).toBe("number");
    }
  });

  it("keeps the fields someone choosing a cafe would want", () => {
    // Not every place has every field, so this checks the set as a whole.
    expect(results.some((result) => typeof result.rating === "number")).toBe(true);
    expect(results.some((result) => typeof result.address === "string")).toBe(true);
    expect(results.some((result) => typeof result.openState === "string")).toBe(true);
  });

  it("drops the bulky nested tables and SerpApi's own links", () => {
    expectNoRawFields(results, [
      "operating_hours",
      "service_options",
      "reviews_link",
      "photos_link",
      "serpapi_thumbnail",
      "place_id",
    ]);
  });
});

describe("compactMaps (single place)", () => {
  it("returns a one-item list when Google answers with place_results", () => {
    // A query naming one business returns an object, not a list.
    const results = compactMaps(
      { place_results: { title: "India Gate", address: "Kartavya Path, New Delhi", rating: 4.6 } },
      5,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("India Gate");
  });
});

describe("compactShopping (real response)", () => {
  const results = compactShopping(asData(shoppingFixture), 5);

  it("trims to maxResults", () => {
    expect(results).toHaveLength(5);
  });

  it("keeps a display price and a numeric price", () => {
    for (const result of results) {
      // The string carries the currency symbol; the number is for comparing.
      expect(typeof result.price).toBe("string");
      expect(typeof result.extractedPrice).toBe("number");
    }
  });

  it("gives every listing a title, shop and link", () => {
    for (const result of results) {
      expect(result.title.length).toBeGreaterThan(0);
      expect(typeof result.source).toBe("string");
      expect(result.link).toMatch(/^https?:\/\//);
    }
  });

  it("drops SerpApi's own product endpoints and tokens", () => {
    expectNoRawFields(results, [
      "serpapi_product_api",
      "immersive_product_page_token",
      "serpapi_immersive_product_api",
      "serpapi_thumbnail",
      "source_icon",
      "product_id",
    ]);
  });
});

describe("compactShopping (source shapes)", () => {
  it("reads a shop given as an object as well as a plain string", () => {
    // Real Google Shopping sends plain strings, with inconsistent casing
    // ("amazon.in" and "Amazon.in" in the same response). Other engines nest it.
    const results = compactShopping(
      {
        shopping_results: [
          { title: "A", price: "₹1", extracted_price: 1, source: "amazon.in" },
          { title: "B", price: "₹2", extracted_price: 2, source: { name: "Flipkart" } },
        ],
      },
      5,
    );

    expect(results[0]?.source).toBe("amazon.in");
    expect(results[1]?.source).toBe("Flipkart");
  });
});

describe("compactFlights (real response)", () => {
  const results = compactFlights(asData(flightsFixture), 5);

  it("trims to maxResults, reading Google's picks first", () => {
    const data = asData(flightsFixture);
    expect(data["best_flights"]).toHaveLength(5);
    expect(data["other_flights"]).toHaveLength(4);

    expect(results).toHaveLength(5);
    // With five recommended itineraries available, all five slots are "best".
    expect(results.every((result) => result.category === "best")).toBe(true);
  });

  it("gives every itinerary a price, a duration and endpoints", () => {
    for (const result of results) {
      expect(typeof result.price).toBe("number");
      expect(typeof result.totalDurationMinutes).toBe("number");
      expect(result.departure.id).toBe("DEL");
      expect(result.arrival.id).toBe("GOX");
      expect(result.departure.time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }
  });

  it("names the airlines and counts the stops", () => {
    for (const result of results) {
      expect(result.airlines.length).toBeGreaterThan(0);
      expect(result.stops).toBe(0); // every recorded itinerary is non-stop
    }
  });

  it("drops booking tokens and logo URLs", () => {
    expectNoRawFields(results, [
      "booking_token",
      "departure_token",
      "airline_logo",
      "legroom",
      "extensions",
    ]);
  });
});

describe("compactFlights (connecting itineraries)", () => {
  // Every recorded flight is non-stop, so the interesting branch — collapsing
  // several legs into one journey — is covered with a hand-built response.
  const connecting = {
    other_flights: [
      {
        flights: [
          {
            departure_airport: { id: "DEL", name: "Indira Gandhi International", time: "2026-10-16 14:20" },
            arrival_airport: { id: "BOM", name: "Chhatrapati Shivaji Maharaj", time: "2026-10-16 16:30" },
            airline: "Air India",
            flight_number: "AI 806",
            travel_class: "Economy",
          },
          {
            departure_airport: { id: "BOM", name: "Chhatrapati Shivaji Maharaj", time: "2026-10-16 17:55" },
            arrival_airport: { id: "GOX", name: "Manohar International", time: "2026-10-16 19:00" },
            airline: "Air India",
            flight_number: "AI 671",
            travel_class: "Economy",
          },
        ],
        layovers: [{ id: "BOM", name: "Chhatrapati Shivaji Maharaj", duration: 85 }],
        total_duration: 280,
        price: 4890,
      },
    ],
  };

  const [itinerary] = compactFlights(connecting, 5);

  it("uses the first departure and the last arrival as the journey's ends", () => {
    expect(itinerary?.departure.id).toBe("DEL");
    expect(itinerary?.arrival.id).toBe("GOX");
  });

  it("counts two legs as one stop", () => {
    expect(itinerary?.stops).toBe(1);
  });

  it("lists a carrier once even when it flies every leg", () => {
    expect(itinerary?.airlines).toEqual(["Air India"]);
    expect(itinerary?.flightNumbers).toEqual(["AI 806", "AI 671"]);
  });

  it("keeps the layover", () => {
    expect(itinerary?.layovers).toEqual([
      { id: "BOM", name: "Chhatrapati Shivaji Maharaj", durationMinutes: 85 },
    ]);
  });

  it("omits layovers entirely for a non-stop flight", () => {
    const [nonStop] = compactFlights(
      {
        best_flights: [
          {
            flights: [
              {
                departure_airport: { id: "DEL", time: "2026-10-16 06:10" },
                arrival_airport: { id: "GOX", time: "2026-10-16 08:45" },
                airline: "IndiGo",
              },
            ],
            layovers: [],
            price: 5432,
          },
        ],
      },
      5,
    );

    // An empty array would be noise; the field should simply not be there.
    expect(nonStop === undefined ? false : "layovers" in nonStop).toBe(false);
  });

  it("falls back to other_flights when Google recommends nothing", () => {
    expect(itinerary?.category).toBe("other");
  });
});

describe("compactHotels (real response)", () => {
  const results = compactHotels(asData(hotelsFixture), 5);

  it("trims to maxResults", () => {
    expect(results).toHaveLength(5);
  });

  it("gives every property a name and flattens its nested rate", () => {
    for (const result of results) {
      expect(result.name.length).toBeGreaterThan(0);
      expect(typeof result.ratePerNight).toBe("string");
      expect(typeof result.extractedRatePerNight).toBe("number");
    }
  });

  it("caps amenities so one property cannot dominate the response", () => {
    // The first recorded property lists fifteen.
    const rawAmenities = (asData(hotelsFixture)["properties"] as Array<{ amenities?: string[] }>)[0]
      ?.amenities;
    expect(rawAmenities?.length).toBeGreaterThan(6);

    for (const result of results) {
      expect(result.amenities?.length ?? 0).toBeLessThanOrEqual(6);
    }
  });

  it("takes a single thumbnail out of the images array", () => {
    for (const result of results) {
      if (result.thumbnail !== undefined) {
        expect(result.thumbnail).toMatch(/^https?:\/\//);
      }
    }
    expect(results.some((result) => result.thumbnail !== undefined)).toBe(true);
  });

  it("keeps ratings and covers both hotels and rentals", () => {
    expect(results.some((result) => typeof result.overallRating === "number")).toBe(true);
    expect(results.some((result) => typeof result.reviews === "number")).toBe(true);
  });

  it("drops property tokens, review breakdowns and SerpApi's own links", () => {
    expectNoRawFields(results, [
      "property_token",
      "nearby_places",
      "reviews_breakdown",
      "serpapi_property_details_link",
      "serpapi_google_hotels_reviews_link",
      "ratings",
      "original_image",
    ]);
  });
});
