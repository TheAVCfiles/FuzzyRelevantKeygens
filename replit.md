# Autography

Autography is a cinematic, safety-first entertainment-response and podcast-development product. It stages, signs, seals, and verifies scoped response artifacts, and can turn a current entertainment question into a grounded, approved two-host podcast sample with a public Cut Key.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/autography run dev` — run the web experience
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run validate:release` — contract freshness, typechecks, API tests, frontend tests, and production builds
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `GEMINI_API_KEY` is required for the Google ADK four-stage signal flow, the ADK Search-grounded source scout, structured evidence/brief/script generation, and multi-speaker TTS.
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
- Google ADK four-stage signal flow: `artifacts/api-server/src/lib/agent-builder-flow.ts`
- Google ADK podcast source scout: `artifacts/api-server/src/lib/podcast-adk-research.ts`
- Podcast grounding, approvals, TTS, persistence, and Cut Keys: `artifacts/api-server/src/lib/podcast-fixtures.ts`
- Podcast producer workspace: `artifacts/autography/src/pages/podcast.tsx`
- Public podcast verification: `artifacts/autography/src/pages/cut.tsx`
- React routes and visual system: `artifacts/autography/src/`

## Architecture decisions

- The Velvet Rope never calls Gemini. It is pure, deterministic policy evaluation with the first failing rule returned.
- Google ADK runs the bounded G1–G4 Gemini read, classify, reconcile, and draft stages. Model output is recorded only as inference and never publishes, approves, or alters deterministic policy.
- Board/PR/Drop scenarios use synthetic fixtures. Podcast normal mode invokes the official `@google/adk` TypeScript framework with `LlmAgent`, `GOOGLE_SEARCH`, and `InMemoryRunner`; it fails closed, and fixtures are restricted to explicit synthetic-demo mode.
- Podcast artifacts are bound to their exact grounded run, source IDs, attestation decision, and human approval receipts. Never resolve a podcast artifact from the globally latest run.
- Private cutting-room raw text is internal only. Public Cut Keys may expose only the producer-authorized summary.
- Cut Key hashes prove artifact integrity and attribution, not factual truth.
- The source scout and G1–G4 signal flow use Google ADK. The podcast evidence editor, brief, script, and multi-speaker speech stages use `@google/genai` directly.
- Current non-secret runtime evidence identifies `Google Gemini API` as the provider and has no Vertex project/location configuration. `@google-cloud/vertexai` is present only as an `@google/adk` transitive dependency; canonical Vertex AI Search redirect URLs may be accepted as Google grounding links. Do not claim a separately deployed managed Agent Engine resource unless runtime evidence verifies one.
- ADK execution evidence may include only framework, provider, model, execution ID, declared tools, latency, activity, and status. Never include prompts, model output, or credentials.
- One `Approve exact script and perform` action creates distinct `SCRIPT_APPROVED` and `AUDIO_RENDER_AUTHORIZED` records bound to the same reviewer commitment, timestamp, script hash, source run, policy version, and ADK parent. Publication remains separately blocked.

## Product

- Board, Constellation, PR, Drop, public verification, and append-only Receipt views.
- Tally and page saturation derive directly from the Call window.
- Scoped response signing, refusal display, Drop sealing, and registry verification.
- Podcast Desk golden path: live question, 3–5 grounded sources, explicit cutting-room decision, development and brief approval, one atomic exact-script/performance approval, two-speaker audio, and a public Cut Key with publication still blocked.
- Current public URL: `https://fuzzy-relevant-keygens.replit.app`. GitHub syncs must retain both the public commit history and the tested Replit Agent checkpoint history; never force-push over public commits.

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
