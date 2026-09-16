/**
 * The smallest useful example.
 *
 * Asks one question, lets the model choose SerpApi tools, prints the answer and
 * shows which searches actually ran.
 *
 * Run it from the repository root:
 *
 *   npm run example:basic
 *
 * THIS SPENDS REAL SEARCH CREDITS — usually one or two, depending on how many
 * tools the model decides it needs.
 */

import { fileURLToPath } from "node:url";

import { google } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import { serpApiTools } from "serpapi-ai-sdk-tools";

// The keys live in one .env at the repository root, two directories up.
// fileURLToPath is what makes this work on Windows, where a URL pathname comes
// out as "/D:/..." and cannot be opened directly.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // No .env file. Fall back to whatever is already in the environment.
}

const question = process.argv.slice(2).join(" ") || "What are people saying about ISRO this week?";

const tools = serpApiTools({
  // Documented, not hard-coded: change these for a different market.
  defaults: { gl: "in", hl: "en", currency: "INR" },
  maxResults: 5,
});

const result = await generateText({
  model: google(process.env["DEMO_MODEL"] ?? "gemini-3.6-flash"),
  instructions:
    "You are a concise research assistant with live web access through SerpApi. " +
    `Today's date is ${new Date().toISOString().slice(0, 10)}. ` +
    "Work out real dates yourself before calling a tool — never pass words like " +
    "'next Friday'. Answer in a few sentences and cite the sources you used.",
  prompt: question,
  tools,
  // Let the model search, read the results, and then answer.
  stopWhen: stepCountIs(5),
});

console.log(`\nQuestion: ${question}\n`);

console.log("Searches that ran:");
let searchCount = 0;
for (const step of result.steps) {
  for (const part of step.content) {
    if (part.type === "tool-call") {
      searchCount += 1;
      console.log(`  ${part.toolName}  ${JSON.stringify(part.input)}`);
    }
  }
}
if (searchCount === 0) console.log("  (none — the model answered without searching)");

console.log(`\nAnswer:\n${result.text}\n`);
console.log(`Search credits used: ${searchCount}\n`);
