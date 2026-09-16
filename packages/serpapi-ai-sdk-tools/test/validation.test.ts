import { describe, expect, it } from "vitest";

import { flightsSearch, hotelsSearch, shoppingSearch } from "../src/index.js";
import { isValidIsoDate, todayIsoDate } from "../src/validate.js";
import { FAKE_KEY, callTool, createFetchMock, expectError, inputSchemaOf } from "./helpers.js";
import flightsFixture from "./fixtures/flights.json";
import hotelsFixture from "./fixtures/hotels.json";

/**
 * Dates are generated relative to today so these tests keep working next year.
 * Hard-coded future dates quietly become past dates and the suite starts lying.
 */
function daysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("isValidIsoDate", () => {
  it("accepts a real date", () => {
    expect(isValidIsoDate("2026-10-03")).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    // JavaScript would roll this over to 3 March; we must not accept it.
    expect(isValidIsoDate("2026-02-31")).toBe(false);
  });

  it("rejects the wrong format", () => {
    expect(isValidIsoDate("03-10-2026")).toBe(false);
    expect(isValidIsoDate("next Friday")).toBe(false);
    expect(isValidIsoDate("2026-10-3")).toBe(false);
  });

  it("accepts a leap day in a leap year and rejects it otherwise", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
  });
});

describe("flights input schema", () => {
  const tool = flightsSearch({ apiKey: FAKE_KEY });

  it("accepts a lowercase IATA code", () => {
    // Models send lowercase often enough that rejecting it would waste turns.
    const parsed = inputSchemaOf(tool).safeParse({
      departureId: "del",
      arrivalId: "gox",
      outboundDate: daysFromToday(14),
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects anything that is not three letters", () => {
    const schema = inputSchemaOf(tool);
    const outboundDate = daysFromToday(14);

    expect(schema.safeParse({ departureId: "DELHI", arrivalId: "GOX", outboundDate }).success).toBe(false);
    expect(schema.safeParse({ departureId: "DE", arrivalId: "GOX", outboundDate }).success).toBe(false);
    expect(schema.safeParse({ departureId: "D3L", arrivalId: "GOX", outboundDate }).success).toBe(false);
  });

  it("requires both airports and an outbound date", () => {
    expect(inputSchemaOf(tool).safeParse({ departureId: "DEL" }).success).toBe(false);
  });
});

describe("flights guards", () => {
  it("rejects the same airport twice without searching", async () => {
    const mock = createFetchMock({ body: flightsFixture });
    const tool = flightsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, {
        departureId: "DEL",
        arrivalId: "del",
        outboundDate: daysFromToday(14),
      }),
    );

    expect(message).toContain("both DEL");
    expect(mock.calls).toHaveLength(0);
  });

  it("rejects a date in the past and says what today is", async () => {
    const mock = createFetchMock({ body: flightsFixture });
    const tool = flightsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, {
        departureId: "DEL",
        arrivalId: "GOX",
        outboundDate: daysFromToday(-3),
      }),
    );

    expect(message).toContain("in the past");
    expect(message).toContain(todayIsoDate());
    expect(mock.calls).toHaveLength(0);
  });

  it("rejects a return date that is not after the outbound date", async () => {
    const mock = createFetchMock({ body: flightsFixture });
    const tool = flightsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, {
        departureId: "DEL",
        arrivalId: "GOX",
        outboundDate: daysFromToday(14),
        returnDate: daysFromToday(10),
      }),
    );

    expect(message).toContain("must be after outboundDate");
    expect(mock.calls).toHaveLength(0);
  });

  it("explains how to ask for a one-way trip", async () => {
    const tool = flightsSearch({ apiKey: FAKE_KEY, fetch: createFetchMock({ body: {} }).fetch });

    const message = expectError(
      await callTool(tool, {
        departureId: "DEL",
        arrivalId: "GOX",
        outboundDate: daysFromToday(14),
        returnDate: daysFromToday(14),
      }),
    );

    expect(message).toContain("leave returnDate out");
  });

  it("sends trip type 2 for one way and 1 for a round trip", async () => {
    const oneWay = createFetchMock({ body: flightsFixture });
    await callTool(flightsSearch({ apiKey: FAKE_KEY, fetch: oneWay.fetch }), {
      departureId: "DEL",
      arrivalId: "GOX",
      outboundDate: daysFromToday(14),
    });
    expect(oneWay.calls[0]?.params["type"]).toBe("2");
    // Google Flights rejects a one-way search that carries a return date.
    expect(oneWay.calls[0]?.params["return_date"]).toBeUndefined();

    const roundTrip = createFetchMock({ body: flightsFixture });
    await callTool(flightsSearch({ apiKey: FAKE_KEY, fetch: roundTrip.fetch }), {
      departureId: "DEL",
      arrivalId: "GOX",
      outboundDate: daysFromToday(14),
      returnDate: daysFromToday(20),
    });
    expect(roundTrip.calls[0]?.params["type"]).toBe("1");
    expect(roundTrip.calls[0]?.params["return_date"]).toBe(daysFromToday(20));
  });

  it("uppercases airport codes and maps the travel class to a number", async () => {
    const mock = createFetchMock({ body: flightsFixture });

    await callTool(flightsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch }), {
      departureId: "del",
      arrivalId: "gox",
      outboundDate: daysFromToday(14),
      travelClass: "business",
      currency: "inr",
    });

    expect(mock.calls[0]?.params).toMatchObject({
      departure_id: "DEL",
      arrival_id: "GOX",
      travel_class: "3",
      currency: "INR",
    });
  });
});

describe("hotels guards", () => {
  it("rejects a check-out that is not after check-in", async () => {
    const mock = createFetchMock({ body: hotelsFixture });
    const tool = hotelsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, {
        query: "hotels in Jaipur",
        checkInDate: daysFromToday(10),
        checkOutDate: daysFromToday(10),
      }),
    );

    expect(message).toContain("at least one night");
    expect(mock.calls).toHaveLength(0);
  });

  it("rejects a check-in date in the past", async () => {
    const mock = createFetchMock({ body: hotelsFixture });
    const tool = hotelsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, {
        query: "hotels in Jaipur",
        checkInDate: daysFromToday(-1),
        checkOutDate: daysFromToday(3),
      }),
    );

    expect(message).toContain("in the past");
    expect(mock.calls).toHaveLength(0);
  });

  it("rejects a date that does not exist", async () => {
    const mock = createFetchMock({ body: hotelsFixture });
    const tool = hotelsSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, {
        query: "hotels in Jaipur",
        checkInDate: daysFromToday(10),
        checkOutDate: "2026-02-31",
      }),
    );

    expect(message).toContain("must be a real date");
    expect(mock.calls).toHaveLength(0);
  });
});

describe("shopping guards", () => {
  it("rejects a price range that is the wrong way round", async () => {
    const mock = createFetchMock({ body: {} });
    const tool = shoppingSearch({ apiKey: FAKE_KEY, fetch: mock.fetch });

    const message = expectError(
      await callTool(tool, { query: "earbuds", minPrice: 5000, maxPrice: 1000 }),
    );

    expect(message).toContain("higher than maxPrice");
    expect(mock.calls).toHaveLength(0);
  });
});
