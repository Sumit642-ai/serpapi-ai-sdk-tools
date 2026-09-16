/**
 * Input checks that run *before* any request is sent.
 *
 * Every function here is cheap and offline. A search rejected at this stage
 * costs zero SerpApi credits, and the model gets a sentence telling it exactly
 * what to fix — which is usually enough for it to retry correctly on its own.
 *
 * These live outside the zod schemas on purpose. zod handles shape and format;
 * rules that compare two fields ("return after outbound") or depend on the
 * clock ("not in the past") are clearer as plain functions, and they keep the
 * JSON Schema the model sees simple.
 */

/** Matches `YYYY-MM-DD`. Format only — says nothing about whether it exists. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Matches three letters, either case. Normalised to uppercase before sending. */
export const IATA_PATTERN = /^[A-Za-z]{3}$/;

/**
 * True only for a real calendar date in `YYYY-MM-DD` form.
 *
 * The round-trip through `Date` is what rejects `2026-02-31`: JavaScript rolls
 * that over to March 3rd, so the formatted result no longer matches the input.
 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Today's date in UTC as `YYYY-MM-DD`.
 *
 * UTC rather than local time is a deliberate simplification: near midnight a
 * user east of UTC may be a day ahead of this. Travel searches are not that
 * precise, and the alternative — guessing the user's timezone — is worse.
 */
export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** ISO dates sort correctly as plain strings, so comparison needs no parsing. */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}

/**
 * Checks one date argument and returns a message to hand back to the model,
 * or `undefined` when the date is fine.
 *
 * @param label  How the field is named to the model, e.g. `"outboundDate"`.
 * @param allowPast  Check-out and return dates are compared to another field
 *   instead, so they skip the "not in the past" rule.
 */
export function checkDate(
  label: string,
  value: string,
  options: { allowPast?: boolean; now?: Date } = {},
): string | undefined {
  if (!isValidIsoDate(value)) {
    return `${label} must be a real date in YYYY-MM-DD format. Received "${value}".`;
  }

  if (options.allowPast !== true) {
    const today = todayIsoDate(options.now);
    if (isBefore(value, today)) {
      return `${label} is in the past (${value}). Today is ${today}. Use today or a later date.`;
    }
  }

  return undefined;
}
