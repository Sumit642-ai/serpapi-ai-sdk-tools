import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

/**
 * Load the repository's single .env.
 *
 * Next only looks for .env inside its own folder, but this repository keeps one
 * .env at the root so there is exactly one file holding the keys. Loading it
 * here puts the values into process.env before the server starts, which is
 * where the chat route reads them from.
 *
 * fileURLToPath is what makes this work on Windows — a URL pathname there looks
 * like "/D:/..." and cannot be opened directly.
 */
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // No .env at the root. Anything already exported in the shell still works.
}

const nextConfig: NextConfig = {
  // Next writes AGENTS.md and CLAUDE.md into this folder on first run. This
  // repository already has its own CLAUDE.md at the root, and generated copies
  // inside an example are just noise in the diff.
  agentRules: false,
};

export default nextConfig;
