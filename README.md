# Autography

**The signature that writes itself.**

Autography is a cinematic, safety-first entertainment response and podcast-development workspace. It combines live public-source grounding, deterministic policy checks, and explicit human approvals so a producer can move quickly without hiding uncertainty or surrendering editorial authority.

## Experience

- **The Board** — a live, short-lived Call with a tally light and an expiring permission window.
- **The Constellation** — observed signal clusters with visible coordination indicators, source diversity, and uncertainty; it never reports public opinion.
- **The PR** — three drafted moves, always including **Stay dark**, so silence is a real choice.
- **The Velvet Rope** — a deterministic six-rule policy engine that can refuse an action before anything publishes.
- **The Drop** — a numbered, sealed artifact with visible claim sourcing and a simulated signature manifest.
- **Is this real?** — a public registry lookup for a Drop ID or hash.
- **The Receipt** — an append-only record of reads, evaluations, refusals, signatures, seals, and expiry.
- **The Podcast Desk** — one gated path from a current entertainment question to an approved two-host audio cut.
- **The Cut Key** — a signed-out, podcast-specific integrity manifest with citations, approvals, execution metadata, line mappings, and hashes.

The Board, PR, Drop, and Receipt scenarios use clearly labeled synthetic fixtures. The Podcast Desk runs live by default and labels synthetic data only when explicit demo mode is enabled.

## Podcast golden path

1. A producer enters a keyword, genre, or current entertainment question.
2. Gemini uses Google Search grounding to retrieve 3–5 current public sources.
3. The desk displays source titles, URLs, retrieval times, source types, support boundaries, and unresolved questions.
4. The producer explicitly adds authorized private cutting-room context or declines it.
5. A human validates the development hypothesis, approves the brief, approves the performed script, and separately approves audio.
6. Gemini generates fresh dialogue for the fictional house voices **FRONT ROW** and **BACKSTAGE**.
7. Gemini multi-speaker TTS renders the approved script with distinct Kore and Puck voices.
8. A public Cut Key exposes privacy-safe lineage for the exact audio artifact.

Normal mode fails closed when live retrieval, structured generation, or audio rendering fails. It never silently substitutes fixtures.

## Architecture

- **React + Vite** serves the authenticated editorial workspace and public verification routes.
- **Express** serves domain state, approval gates, the Drop registry, the receipt ledger, public Cut Keys, and audio streaming.
- **The Velvet Rope** is a pure deterministic rule engine, outside the model path. It enforces window, countersignature, scope, exclusion, evidence, and reach checks in order.
- **Google Gemini via `@google/genai`** performs Search-grounded source scouting, structured evidence editing, brief generation, script performance, and multi-speaker TTS.
- **OpenAPI + Orval + Zod** keep browser hooks and server validators generated from one contract.
- **Human approvals and deterministic authority checks** stay outside the model path. Gemini cannot approve, publish, or relax policy.
- **Per-artifact binding** carries the exact grounded run, citations, attestation, approvals, and executions through the Cut Key.

Autography implements a four-stage Google agent workflow in `artifacts/api-server/src/lib/agent-builder-flow.ts` with the official `@google/genai` SDK. It invokes Gemini at runtime for read, classify, reconcile, and draft stages; it does not deploy a separate Agent Engine resource.

## Runtime modes

- `Live Gemini` — normal runtime with real Google Search grounding and Gemini generation.
- `Synthetic Demo` — available only when `PODCAST_SYNTHETIC_DEMO=true`; every surface labels it.
- `Failed` — live failure state. No fixture artifact is created.

Cut Key hashes prove integrity and attribution for the rendered artifact. They do not prove that every source claim is true.

## Gemini setup

Set `GEMINI_API_KEY` as a secure environment secret. The server calls the Google GenAI SDK only from the API service; the key is never exposed to the browser.

For production producer access, configure Clerk server/client secrets and set `publicMetadata.autography_role` to `producer` on authorized users. Local preview role emulation is development-only.

## Local development

- `pnpm --filter @workspace/autography run dev` — web interface
- `pnpm --filter @workspace/api-server run dev` — API service
- `pnpm --filter @workspace/autography test` — frontend component checks
- `pnpm --filter @workspace/api-server test` — API and policy checks using isolated test state
- `pnpm run typecheck` — verify the workspace
- `pnpm --filter @workspace/api-spec run codegen` — regenerate clients and validators after OpenAPI changes

## Deployment readiness

The web and API workflows are configured for Replit and bind through the registered artifacts. Production operation requires:

1. Configure production Gemini and Clerk secrets in Replit Secrets.
2. Confirm producer roles in the production Clerk tenant.
3. Keep `PODCAST_SYNTHETIC_DEMO` unset or `false`.
4. Run typechecks and both test suites.
5. Publish the registered Autography web and API artifacts through Replit.

Public competition build:

- Source: https://github.com/TheAVCfiles/FuzzyRelevantKeygens
- Hosted app: https://fuzzy-relevant-keygens.replit.app
- License: MIT

## Competition submission notes

Autography calls Google Gemini directly through the official `@google/genai`
SDK. Gemini provides Google Search-grounded source scouting, structured
evidence and editorial generation, fresh two-host dialogue, and multi-speaker
text-to-speech. Deterministic policy checks and every approval or publishing
decision remain outside the model path.

The competition workflow is implemented through the official `@google/genai`
SDK and invokes live Gemini and Google Search at runtime. It does not deploy a
separate Google ADK or Agent Engine runtime.

The Board, PR, Drop, and Receipt examples are synthetic. The Podcast Desk uses
live Gemini and Google Search grounding by default; synthetic podcast data is
available only in explicitly labeled demo mode.

## License

MIT. See [LICENSE](LICENSE).