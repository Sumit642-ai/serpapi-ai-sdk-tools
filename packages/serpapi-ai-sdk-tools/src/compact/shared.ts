/**
 * Small readers for untyped SerpApi JSON.
 *
 * SerpApi responses vary: a field can be missing, or arrive as a string where
 * a number was expected, or be an object in one engine and a plain string in
 * another. Rather than sprinkle `as any` everywhere, every compactor reads
 * through these, so a surprising payload produces a missing field instead of a
 * crash in the middle of an agent run.
 */

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Returns a non-empty trimmed string, or `undefined`. */
export function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/** Returns a finite number, accepting numeric strings like `"1,299"`. */
export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Reads a field that may be either a plain string or an object with a `name`.
 *
 * Google News returns `source: { name: "Ars Technica" }` while other engines
 * return `source: "Amazon"`. Callers just want the name.
 */
export function asName(value: unknown): string | undefined {
  const direct = asString(value);
  if (direct !== undefined) return direct;

  const record = asRecord(value);
  return record === undefined ? undefined : asString(record["name"]);
}

/**
 * Drops keys whose value is `undefined`.
 *
 * Compact results are built by assembling every possible field and then
 * removing the ones that were not present. This keeps the JSON the model sees
 * free of `"rating": null` noise, which is pure wasted tokens.
 */
export function omitUndefined<T extends object>(object: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

/** Keeps the first `limit` items of a list of strings, dropping blanks. */
export function asStringList(value: unknown, limit: number): string[] | undefined {
  const items = asArray(value)
    .map((item) => asString(item))
    .filter((item): item is string => item !== undefined)
    .slice(0, limit);

  return items.length === 0 ? undefined : items;
}
