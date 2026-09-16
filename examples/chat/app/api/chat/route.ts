import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { serpApiTools } from "serpapi-ai-sdk-tools";

export const maxDuration = 30;

/**
 * The tools, built once when the module loads.
 *
 * Note this imports `serpapi-ai-sdk-tools` by name, through the npm workspace —
 * not by a relative path into `src`. That is deliberate: the demo only proves
 * the package works if it consumes it the way a real application would, through
 * the built `dist` and the `exports` map.
 *
 * The cache means that asking the same thing twice in one session costs one
 * SerpApi credit rather than two, which matters on the free plan.
 */
const tools = serpApiTools({
  defaults: { gl: "in", hl: "en", currency: "INR" },
  maxResults: 5,
  cache: { ttlMs: 5 * 60 * 1000 },
});

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const today = new Date().toISOString().slice(0, 10);

  const result = streamText({
    model: google(process.env.DEMO_MODEL ?? "gemini-3.6-flash"),
    instructions: [
      "You are a helpful assistant with live search through SerpApi.",
      `Today's date is ${today}.`,
      "",
      "Rules that matter:",
      `- Work out real calendar dates yourself. Tools need YYYY-MM-DD, so turn`,
      `  "next Friday" or "this weekend" into actual dates before calling them.`,
      "- Airports are 3-letter IATA codes: DEL Delhi, BOM Mumbai, GOI/GOX Goa,",
      "  BLR Bengaluru, MAA Chennai, HYD Hyderabad, CCU Kolkata.",
      "- Pick the tool that fits: flightsSearch for flights, hotelsSearch for",
      "  stays, mapsSearch for places, shoppingSearch for prices, newsSearch for",
      "  recent events, webSearch for everything else.",
      "- If a tool returns an error, read it and fix the input rather than",
      "  repeating the same call.",
      "",
      "Answer briefly. The results are shown to the user as cards underneath your",
      "reply, so summarise and compare rather than listing every field.",
    ].join("\n"),
    messages: await convertToModelMessages(messages),
    tools,
    // Search, read what came back, then answer.
    stopWhen: stepCountIs(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, tools }),
  });
}
