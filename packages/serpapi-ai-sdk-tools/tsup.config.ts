import { defineConfig } from "tsup";

// Note on the TypeScript version: this package is pinned to TypeScript 5.x on
// purpose. tsup builds `.d.ts` files with rollup-plugin-dts, which uses the
// TypeScript compiler API; TypeScript 6 and the native 7 rewrite both change
// that API enough to break the dts step ("Cannot read properties of undefined
// (reading 'useCaseSensitiveFileNames')"). The JS output builds fine on all
// three — it is only the type declarations that fail. Bump TypeScript here only
// after `npm run build` still produces dist/index.d.ts and dist/index.d.cts.
export default defineConfig({
  entry: ["src/index.ts"],
  // Dual output so the package works from both `import` and `require`.
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "node20",
  outDir: "dist",
  // `ai` and `zod` are peer dependencies, so they must never be bundled in.
  external: ["ai", "zod"],
});
