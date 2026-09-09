# Autography

Autography is a cinematic, safety-first entertainment-response and podcast-development product. It stages, signs, seals, and verifies scoped response artifacts, and can turn a current entertainment question into a grounded, approved two-host podcast sample with a public Cut Key.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/autography run dev` — run the web experience
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `GEMINI_API_KEY` is required for live Search grounding, structured evidence/brief/script generation, and multi-speaker TTS.
- `PODCAST_SYNTHETIC_DEMO=true` enables explicitly labeled podcast fixtures. Keep it unset/false in normal and production operation.

## Producer access

- Shared and production approvals require a verified Clerk session.
- Producer permission comes from Clerk user `publicMetadata.autography_role` set to `producer`. This metadata is server-controlled and cannot be changed by the browser.
- Grant or revoke producer access from Replit's Auth user management pane by editing that user's public metadata. Removing the key returns the user to read-only `viewer` access on their next request.
- Local preview impersonation is available only when both `NODE_ENV=development` and `AUTOGRAPHY_PREVIEW_ROLE_MODE=true`; it is never an authorization path in shared or production environments.
- Production Clerk frontend requests default to the same-origin `/api/__clerk` proxy; development uses Clerk's hosted endpoint because development instances reject custom proxy hosts.
- The web and API use browser-managed cookies. Do not enable wildcard credentialed CORS or add browser bearer-token storage.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract: `lib/api-spec/openapi.yaml`
- Deterministic policy engine: `artifacts/api-server/src/policy/rope.ts`
- Fixture-backed domain data and receipt registry: `artifacts/api-server/src/lib/autography-fixtures.ts`
- Google ADK-orchestrated Gemini four-stage flow: `artifacts/api-server/src/lib/agent-builder-flow.ts`
- Podcast grounding, approvals, TTS, persistence, and Cut Keys: `artifacts/api-server/src/lib/podcast-fixtures.ts`
- Podcast producer workspace: `artifacts/autography/src/pages/podcast.tsx`
- Public podcast verification: `artifacts/autography/src/pages/cut.tsx`
- React routes and visual system: `artifacts/autography/src/`

## Architecture decisions

- The Velvet Rope never calls Gemini. It is pure, deterministic policy evaluation with the first failing rule returned.
- Google ADK orchestrates the read, classify, reconcile, and draft Gemini stages. Their output is recorded as model inference and never publishes or alters fixture presentation data.
- Board/PR/Drop scenarios use synthetic fixtures. Podcast normal mode uses live Google Search grounding and fails closed; fixtures are restricted to explicit synthetic-demo mode.
- Podcast artifacts are bound to their exact grounded run, source IDs, attestation decision, and human approval receipts. Never resolve a podcast artifact from the globally latest run.
- Private cutting-room raw text is internal only. Public Cut Keys may expose only the producer-authorized summary.
- Cut Key hashes prove artifact integrity and attribution, not factual truth.
- Use `@google/adk` only for the four-stage analysis orchestration. Direct `@google/genai` remains responsible for Search grounding, structured podcast generation, and TTS. Do not claim Agent Builder or Agent Engine.

## Product

- Board, Constellation, PR, Drop, public verification, and append-only Receipt views.
- Tally and page saturation derive directly from the Call window.
- Scoped response signing, refusal display, Drop sealing, and registry verification.
- Podcast Desk golden path: live question, 3–5 grounded sources, explicit cutting-room decision, development/brief/script/audio approvals, two-speaker audio, and public Cut Key.

## User preferences

- Follow the supplied Autography visual direction exactly: six colors, four type roles, no real people or footage, and no interface claims about public opinion.

## Gotchas

- Run API codegen after any `lib/api-spec/openapi.yaml` change.
- Do not put the Gemini API key in browser code or logs.
- Vite builds need workflow-provided `PORT` and `BASE_PATH`; use the artifact workflow rather than running a root `dev` script.
- API tests use isolated podcast state/audio paths. Keep tests from overwriting the running demo's persisted state.
- The public Cut Key route must remain outside authenticated podcast middleware; key-bound audio is current-only and may not expose private attestation text.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
