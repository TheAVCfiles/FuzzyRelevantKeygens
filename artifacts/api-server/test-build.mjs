import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm(".test-dist", { recursive: true, force: true });
await build({
  entryPoints: [
    "src/policy/rope.test.ts",
    "src/lib/autography-fixtures.test.ts",
    "src/lib/podcast-fixtures.test.ts",
    "src/lib/podcast-persistence.integration.test.ts",
    "src/routes/autography-auth.test.ts",
    "src/app.test.ts",
  ],
  bundle: true,
  format: "esm",
  platform: "node",
  outdir: ".test-dist",
  sourcemap: "inline",
  external: [
    "@clerk/express",
    "@clerk/shared",
    "@google/adk",
    "@google/genai",
    "@google-cloud/storage",
    "cookie-parser",
    "cors",
    "express",
    "http-proxy-middleware",
    "pino",
    "pino-http",
    "pg",
  ],
});