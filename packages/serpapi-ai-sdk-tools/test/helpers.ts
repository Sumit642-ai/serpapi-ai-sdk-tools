import type { FetchFunction } from "../src/types.js";

/**
 * A stand-in API key.
 *
 * Deliberately distinctive so the leak tests can search any string for it and
 * be certain a match really came from the key and not from ordinary words.
 */
export const FAKE_KEY = "FAKE_TEST_KEY_2f8a1c7e_NEVER_REAL";

/** How the mock should answer one call. */
export interface MockResponseSpec {
  /** Parsed JSON body to return. */
  body?: unknown;
  /** Exact text to return instead of `body`, for testing unparseable responses. */
  rawBody?: string;
  status?: number;
  statusText?: string;
  /** Throw instead of answering, to simulate a network failure. */
  throws?: unknown;
  /** Wait before answering, so timeout and abort can be tested. */
  delayMs?: number;
}

export interface RecordedCall {
  url: URL;
  /** Query parameters as a plain object, for readable assertions. */
  params: Record<string, string>;
}

export interface FetchMock {
  fetch: FetchFunction;
  calls: RecordedCall[];
}

/**
 * Builds a fake `fetch` that never touches the network.
 *
 * Pass one spec to answer every call the same way, or an array to answer a
 * sequence — the last entry repeats once the array runs out.
 */
export function createFetchMock(spec: MockResponseSpec | MockResponseSpec[]): FetchMock {
  const specs = Array.isArray(spec) ? spec : [spec];
  const calls: RecordedCall[] = [];
  let callIndex = 0;

  const fetchImpl = async (input: unknown, init?: { signal?: AbortSignal }) => {
    const url = new URL(String(input));
    calls.push({ url, params: Object.fromEntries(url.searchParams) });

    const current = specs[Math.min(callIndex, specs.length - 1)] ?? {};
    callIndex += 1;

    // Mirror a real request: a pending fetch rejects when its signal aborts.
    if (current.delayMs !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, current.delayMs);
        init?.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(init.signal?.reason ?? new Error("Aborted"));
          },
          { once: true },
        );
      });
    }

    if (current.throws !== undefined) {
      throw current.throws;
    }

    const payload = current.rawBody ?? JSON.stringify(current.body ?? {});

    return new Response(payload, {
      status: current.status ?? 200,
      statusText: current.statusText ?? "OK",
      headers: { "content-type": "application/json" },
    });
  };

  return { fetch: fetchImpl as unknown as FetchFunction, calls };
}

/**
 * Calls a tool's `execute` the way the AI SDK would.
 *
 * Note this bypasses the zod schema, exactly as it skips a real model — so a
 * test that calls this is testing the tool's own guards. Schema-level checks
 * are tested separately through `inputSchemaOf`.
 */
export async function callTool<T = unknown>(
  tool: unknown,
  input: unknown,
  options: { abortSignal?: AbortSignal } = {},
): Promise<T> {
  const execute = (tool as { execute?: (...args: unknown[]) => unknown }).execute;

  if (typeof execute !== "function") {
    throw new Error("That tool has no execute function.");
  }

  return (await execute(input, {
    toolCallId: "test-call-id",
    messages: [],
    ...options,
  })) as T;
}

/** Reaches the zod schema a tool advertises, so validation can be tested directly. */
export function inputSchemaOf(tool: unknown): {
  safeParse: (value: unknown) => { success: boolean };
} {
  return (tool as { inputSchema: { safeParse: (value: unknown) => { success: boolean } } })
    .inputSchema;
}

/** Narrowing helper: fails the test if the result was an error. */
export function expectSuccess<T>(result: unknown): {
  engine: string;
  params: Record<string, string>;
  results: T[];
  note?: string;
} {
  if (typeof result === "object" && result !== null && "error" in result) {
    throw new Error(`Expected a successful result but got: ${String((result as { error: string }).error)}`);
  }
  return result as { engine: string; params: Record<string, string>; results: T[]; note?: string };
}

/** Narrowing helper: fails the test if the result was not an error. */
export function expectError(result: unknown): string {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    throw new Error(`Expected an error result but got: ${JSON.stringify(result)}`);
  }
  return (result as { error: string }).error;
}
