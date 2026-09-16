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

/** Fixtures are read-only JSON; the compactors take a plain record. */
const asData = (fixture: unknown) => fixture as Record<string, unknown>;

describe("compactWeb", () => {
  it("keeps the useful fields and drops SerpApi metadata", () => {
    const results = compactWeb(asData(webFixture), 5);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      position: 1,
      title: "SerpApi: Google Search API",
      link: "https://serpapi.com/",
      snippet: "Scrape Google and other search engines from our fast, easy, and complete API.",
      source: "https://serpapi.com",
    });

    // Sitelinks, pagination and search_metadata are pure overhead for a model.
    expect(JSON.stringify(results)).not.toContain("sitelinks");
    expect(JSON.stringify(results)).not.toContain("serpapi_pagination");
    expect(JSON.stringify(results)).not.toContain("search_metadata");
  });

  it("respects maxResults", () => {
    expect(compactWeb(asData(webFixture), 2)).toHaveLength(2);
  });

  it("omits fields that are absent rather than emitting nulls", () => {
    const [first] = compactWeb(asData(webFixture), 1);
    expect(first).toBeDefined();
    expect("date" in first!).toBe(false);
  });

  it("returns an empty list for a response with no organic results", () => {
    expect(compactWeb({}, 5)).toEqual([]);
  });
});

describe("compactNews", () => {
  it("reads the publisher name out of the source object", () => {
    const results = compactNews(asData(newsFixture), 5);

    expect(results[0]?.source).toBe("The Hindu");
    expect(results[0]?.isoDate).toBe("2026-09-14T01:30:00Z");
  });

  it("flattens grouped stories into individual articles", () => {
    const results = compactNews(asData(newsFixture), 5);

    // The fixture has one plain article plus a heading wrapping two stories.
    // The heading itself must not appear; its two stories must.
    expect(results.map((item) => item.title)).toEqual([
      "ISRO completes key test for next lunar mission",
      "Gaganyaan crew module clears splashdown trial",
      "What the splashdown trial means for 2027",
    ]);
  });
});

describe("compactMaps", () => {
  it("flattens coordinates and keeps the practical fields", () => {
    const results = compactMaps(asData(mapsFixture), 5);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      title: "Blue Tokai Coffee Roasters",
      address: "N-Block, Connaught Place, New Delhi, Delhi 110001",
      rating: 4.4,
      reviews: 2183,
      latitude: 28.6304,
      longitude: 77.2177,
      openState: "Open ⋅ Closes 11 pm",
    });

    // The nested operating_hours table is dropped; open_state says enough.
    expect(JSON.stringify(results)).not.toContain("operating_hours");
  });

  it("handles a single place_results response as a one-item list", () => {
    const single = {
      place_results: {
        title: "India Gate",
        address: "Kartavya Path, New Delhi",
        rating: 4.6,
      },
    };

    const results = compactMaps(single, 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("India Gate");
  });
});

describe("compactShopping", () => {
  it("keeps both the display price and the numeric price", () => {
    const results = compactShopping(asData(shoppingFixture), 5);

    expect(results[0]).toMatchObject({
      title: "boAt Airdopes 141 Wireless Earbuds",
      price: "₹1,299",
      extractedPrice: 1299,
      source: "Amazon.in",
      rating: 4.1,
    });
  });

  it("reads a source given as an object as well as a plain string", () => {
    const results = compactShopping(asData(shoppingFixture), 5);

    expect(results[0]?.source).toBe("Amazon.in");
    expect(results[1]?.source).toBe("Flipkart");
  });
});

describe("compactFlights", () => {
  it("flattens a non-stop itinerary", () => {
    const results = compactFlights(asData(flightsFixture), 5);
    const nonStop = results[0];

    expect(nonStop).toMatchObject({
      price: 5432,
      category: "best",
      totalDurationMinutes: 155,
      airlines: ["IndiGo"],
      flightNumbers: ["6E 2043"],
      stops: 0,
      travelClass: "Economy",
      carbonEmissionsGrams: 95000,
    });
    expect(nonStop?.departure).toEqual({
      id: "DEL",
      name: "Indira Gandhi International Airport",
      time: "2026-10-03 06:10",
    });
    expect(nonStop?.arrival.id).toBe("GOX");

    // An empty layovers array should not become an empty field.
    expect("layovers" in nonStop!).toBe(false);
  });

  it("collapses a two-leg itinerary into one stop and endpoints", () => {
    const results = compactFlights(asData(flightsFixture), 5);
    const oneStop = results[1];

    expect(oneStop?.stops).toBe(1);
    // The journey runs DEL -> BOM -> GOX, so the endpoints are the outer two.
    expect(oneStop?.departure.id).toBe("DEL");
    expect(oneStop?.arrival.id).toBe("GOX");
    expect(oneStop?.layovers).toEqual([
      {
        id: "BOM",
        name: "Chhatrapati Shivaji Maharaj International Airport",
        durationMinutes: 85,
      },
    ]);
  });

  it("lists a carrier once even when it flies every leg", () => {
    const results = compactFlights(asData(flightsFixture), 5);

    // Air India operates both legs of the second itinerary.
    expect(results[1]?.airlines).toEqual(["Air India"]);
  });

  it("puts Google's recommended flights before the rest", () => {
    const results = compactFlights(asData(flightsFixture), 5);
    expect(results.map((item) => item.category)).toEqual(["best", "other"]);
  });

  it("drops booking tokens and logos", () => {
    const serialised = JSON.stringify(compactFlights(asData(flightsFixture), 5));

    expect(serialised).not.toContain("booking_token");
    expect(serialised).not.toContain("EXAMPLE_BOOKING_TOKEN_1");
    expect(serialised).not.toContain("airline_logo");
  });
});

describe("compactHotels", () => {
  it("flattens nested rates and coordinates", () => {
    const results = compactHotels(asData(hotelsFixture), 5);

    expect(results[0]).toMatchObject({
      name: "Hotel Pearl Palace",
      type: "hotel",
      ratePerNight: "₹2,400",
      extractedRatePerNight: 2400,
      totalRate: "₹4,800",
      overallRating: 4.5,
      reviews: 3120,
      hotelClass: 3,
      latitude: 26.9124,
      longitude: 75.7873,
    });
  });

  it("caps amenities so one property cannot dominate the response", () => {
    const results = compactHotels(asData(hotelsFixture), 5);

    // The fixture lists eight amenities for the first property.
    expect(results[0]?.amenities).toHaveLength(6);
    expect(results[0]?.amenities?.[0]).toBe("Free Wi-Fi");
  });

  it("takes the first image as the thumbnail", () => {
    const results = compactHotels(asData(hotelsFixture), 5);

    expect(results[0]?.thumbnail).toBe("https://lh5.googleusercontent.com/example-hotel-1-thumb");
  });

  it("drops property tokens and nearby-place tables", () => {
    const serialised = JSON.stringify(compactHotels(asData(hotelsFixture), 5));

    expect(serialised).not.toContain("property_token");
    expect(serialised).not.toContain("nearby_places");
  });
});
