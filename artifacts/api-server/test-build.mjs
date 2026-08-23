import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm(".test-dist", { recursive: true, force: true });
await build({
  entryPoints: [
    "src/policy/rope.test.ts",
    "src/lib/autography-fixtures.test.ts",
    "src/lib/podcast-fixtures.test.ts",
  ],
  bundle: true,
  format: "esm",
  platform: "node",
  outdir: ".test-dist",
  sourcemap: "inline",
  external: [
    "@google/genai",
    "cookie-parser",
    "cors",
    "express",
    "pino",
    "pino-http",
  ],
});