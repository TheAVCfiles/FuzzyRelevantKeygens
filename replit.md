# Autography

Autography is a synthetic broadcast-control-room experience for staging, signing, sealing, and verifying a scoped post-episode response.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/autography run dev` — run the web experience
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `GEMINI_API_KEY` is required for the live four-stage read/classify/reconcile/draft enrichment flow.

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
- Google Gemini four-stage flow: `artifacts/api-server/src/lib/agent-builder-flow.ts`
- React routes and visual system: `artifacts/autography/src/`

## Architecture decisions

- The Velvet Rope never calls Gemini. It is pure, deterministic policy evaluation with the first failing rule returned.
- Gemini only reads, classifies, reconciles, and drafts. Its output is recorded as model inference and never publishes or alters fixture presentation data.
- The app uses entirely synthetic fixtures and records. Coordination is shown as a likelihood with visible signals, never as a verdict.
- A fixture fallback keeps the demo available if a live Gemini call fails; the failure is recorded in the Receipt instead of being hidden.

## Product

- Board, Constellation, PR, Drop, public verification, and append-only Receipt views.
- Tally and page saturation derive directly from the Call window.
- Scoped response signing, refusal display, Drop sealing, and registry verification.

## User preferences

- Follow the supplied Autography visual direction exactly: six colors, four type roles, no real people or footage, and no interface claims about public opinion.

## Gotchas

- Run API codegen after any `lib/api-spec/openapi.yaml` change.
- Do not put the Gemini API key in browser code or logs.
- Vite builds need workflow-provided `PORT` and `BASE_PATH`; use the artifact workflow rather than running a root `dev` script.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
