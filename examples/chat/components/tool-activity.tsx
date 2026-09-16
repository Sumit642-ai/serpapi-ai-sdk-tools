/**
 * The line that makes SerpApi usage visible.
 *
 * Every search shows which tool ran, which SerpApi engine answered it, and the
 * exact inputs that were sent. Without this the demo just looks like a model
 * that happens to know things.
 */

/** Inputs that are plumbing rather than intent, and only add noise on screen. */
const HIDDEN_PARAMS = new Set(["output", "type", "hl"]);

function summariseParams(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([key]) => !HIDDEN_PARAMS.has(key))
    .map(([key, value]) => `${key}=${value}`)
    .join("  ");
}

export function ToolActivity({
  toolName,
  engine,
  params,
  status,
}: {
  toolName: string;
  engine?: string;
  params?: Record<string, string>;
  status: "running" | "done" | "failed";
}) {
  return (
    <div className={`activity${status === "failed" ? " failed" : ""}`}>
      <span className="tag">{toolName}</span>
      {engine ? <span className="tag">{engine}</span> : null}

      {status === "running" ? <span>searching SerpApi…</span> : null}
      {status === "failed" ? <span>search failed</span> : null}

      {params ? <span className="params">{summariseParams(params)}</span> : null}
    </div>
  );
}
