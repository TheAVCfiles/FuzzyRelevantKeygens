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
2. A Google ADK `LlmAgent` invokes Google Search grounding to retrieve 3–5 current public sources.
3. The desk displays source titles, URLs, retrieval times, source types, support boundaries, and unresolved questions.
4. The producer explicitly adds authorized private cutting-room context or declines it.
5. A human validates the development hypothesis, approves the brief, approves the performed script, and separately approves audio.
6. Gemini generates fresh dialogue for the fictional house voices **FRONT ROW** and **BACKSTAGE**.
7. Gemini multi-speaker TTS renders the approved script with distinct Kore and Puck voices.
8. A public Cut Key exposes bounded lineage for the exact audio artifact. Raw source snippets, copied comments, reviewer identity, credentials, and private cutting-room text are excluded; public citation URLs remain visible.

Normal mode fails closed when live retrieval, structured generation, or audio rendering fails. It never silently substitutes fixtures.

## Architecture

- **React + Vite** serves the authenticated editorial workspace and public verification routes.
- **Express** serves domain state, approval gates, the Drop registry, the receipt ledger, public Cut Keys, and audio streaming.
- **The Velvet Rope** is a pure deterministic rule engine, outside the model path. It enforces window, countersignature, scope, exclusion, evidence, and reach checks in order.
- **Google ADK via `@google/adk`** runs both the live Search-grounded podcast source scout and the existing G1–G4 read, classify, reconcile, and draft orchestration with real `LlmAgent` and `InMemoryRunner` invocations.
- **Google Gemini via `@google/genai`** performs the bounded podcast evidence edit, brief generation, script performance, and multi-speaker TTS after the ADK scout.
- **OpenAPI + Orval + Zod** keep browser hooks and server validators generated from one contract.
- **Human approvals and deterministic authority checks** stay outside the model path. Gemini cannot approve, publish, or relax policy.
- **Per-artifact binding** carries the exact grounded run, citations, attestation, approvals, and executions through the Cut Key.

Autography uses the official Google Agent Development Kit TypeScript framework in the live podcast research path and the four-stage signal-room agent flow. This is a real Google ADK runtime integration; it does not use or claim a managed Vertex AI Agent Builder or Agent Engine deployment.
## Runtime modes

- `Live Google ADK` — normal runtime with a real ADK source-scout invocation, Google Search grounding, and downstream Gemini generation.
- Retained `Live Gemini` runs remain readable. Completing one now requires fresh typed development, brief, script, and audio approvals bound to its current artifacts; judge evidence must start from a live Google ADK scout.
- `Synthetic Demo` — available only when `PODCAST_SYNTHETIC_DEMO=true`; every surface labels it.
- `Failed` — live failure state. No fixture artifact is created.

Cut Key hashes prove integrity and attribution for the rendered artifact. Source and claim mappings establish citation lineage and declared support boundaries; they are not an independent fact-check and do not prove that every claim is true.

## Google ADK and Gemini setup

Choose exactly one server-side transport:

- **Gemini Developer API** — set one matching API-key variable: `GEMINI_API_KEY`, `GOOGLE_GENAI_API_KEY`, or `GOOGLE_API_KEY`.
- **Vertex AI** — set `GOOGLE_GENAI_USE_VERTEXAI=true` (or its SDK alias `GOOGLE_GENAI_USE_ENTERPRISE=true`), `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`; authentication uses Application Default Credentials.

Do not combine API-key and Vertex settings or set custom Gemini/Vertex base-URL overrides. Mixed, ambiguous, missing, incomplete, or unverifiable configuration fails closed. Google ADK and the Google GenAI SDK are called only from the API service; credentials are never exposed to the browser or execution evidence. Normal mode does not fall back to direct source scouting or fixtures when ADK fails.

Each live source-scout and G1–G4 execution exposes only safe runtime evidence: framework, provider, model, ADK invocation ID, declared tools, latency, activity, completed/failed status, and a credential-free transport descriptor. The signal room shows the four stage IDs after a successful run. Prompts, model output, credentials, project IDs, and locations are not included in that evidence.

For production producer access, configure Clerk server/client secrets. Producer authority comes only from the server-controlled `publicMetadata.autography_role` value. Either set that value to `producer` through trusted user management, or use the one-time in-app claim after configuring `AUTOGRAPHY_PRODUCER_BOOTSTRAP_USER_ID` for the exact Clerk user. `AUTOGRAPHY_PRODUCER_BOOTSTRAP_EMAIL` is also supported, but only a matching verified primary Clerk email is accepted. The durable claim is identity-bound and recoverable by the same user after an interrupted Clerk response. Remove the bootstrap allowlist setting after the claim succeeds. Local preview role emulation is development-only.


## Local development

- `pnpm --filter @workspace/autography run dev` — web interface
- `pnpm --filter @workspace/api-server run dev` — API service
- `pnpm --filter @workspace/autography test` — frontend component checks
- `pnpm --filter @workspace/api-server test` — API and policy checks using isolated test state
- `pnpm run typecheck` — verify the workspace
- `pnpm --filter @workspace/api-spec run codegen` — regenerate clients and validators after OpenAPI changes
- `pnpm run validate:release` — full contract, typecheck, API test, frontend test, and production-build validation
- `pnpm --filter @workspace/scripts cleanup:podcast-audio` — dry-run inventory of App Storage WAVs not referenced by PostgreSQL; add `--apply` to delete only exact objects older than the seven-day retention window
## License

MIT. See [LICENSE](LICENSE).


## Competition submission notes

Autography uses the official Google Agent Development Kit through `@google/adk`
for Search-grounded source scouting and to orchestrate its read, classify,
reconcile, and draft analysis stages. It also calls Gemini directly through the
official `@google/genai` SDK for structured evidence and editorial generation,
fresh two-host dialogue, and multi-speaker text-to-speech. Deterministic policy
checks and every approval or publishing decision remain outside both model
paths.

This build does **not** use Agent Builder or Agent Engine and does not claim
those services.

The Board, PR, Drop, and Receipt examples are synthetic. The Podcast Desk uses
live Gemini and Google Search grounding by default; synthetic podcast data is
available only in explicitly labeled demo mode.

## Exact-commit release audit

Before any future publish, first commit all intended changes and record both
identifiers from that exact commit:

```sh
EXPECTED_COMMIT=$(git rev-parse HEAD)
EXPECTED_TREE=$(git rev-parse HEAD^{tree})
pnpm run audit:release --expected-commit "$EXPECTED_COMMIT" --expected-tree "$EXPECTED_TREE"
```

This preview/local-only, offline audit fails closed for a dirty worktree, a
different HEAD or tree, stale generated API clients, or a stale pnpm lockfile.
It emits one secret-free JSON envelope with the exact commit, tree, and gate
results. Passing the audit is a prerequisite only; the command does not publish
or deploy anything.


## Deployment readiness

The web and API workflows are configured for Replit and bind through the registered artifacts. Production operation requires:

1. Configure production Gemini and Clerk secrets in Replit Secrets.
2. Configure the exact one-time production producer identity with `AUTOGRAPHY_PRODUCER_BOOTSTRAP_USER_ID` (preferred) or `AUTOGRAPHY_PRODUCER_BOOTSTRAP_EMAIL`.
3. Confirm the producer role in the production Clerk tenant, then remove the bootstrap allowlist setting.
4. Keep `PODCAST_SYNTHETIC_DEMO` unset or `false`.
5. Run `pnpm run validate:release`.
6. Run the exact-commit release audit above against the commit intended for publishing.
7. Publish the registered Autography web and API artifacts through Replit.

Public competition build:

- Source: https://github.com/TheAVCfiles/FuzzyRelevantKeygens
- Hosted app: https://fuzzy-relevant-keygens.replit.app
- License: MIT
