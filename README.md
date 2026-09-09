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
8. A public Cut Key exposes privacy-safe lineage for the exact audio artifact.

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

Autography uses the open-source Google ADK TypeScript framework in the live podcast research path and the four-stage signal-room agent flow. This is a real Google ADK runtime integration; it does not claim a managed Vertex AI Agent Builder or Agent Engine deployment.

## Runtime modes

- `Live Google ADK` — normal runtime with a real ADK source-scout invocation, Google Search grounding, and downstream Gemini generation.
- Retained `Live Gemini` runs remain readable and can complete their already-bound approval path for backward compatibility.
- `Synthetic Demo` — available only when `PODCAST_SYNTHETIC_DEMO=true`; every surface labels it.
- `Failed` — live failure state. No fixture artifact is created.

Cut Key hashes prove integrity and attribution for the rendered artifact. They do not prove that every source claim is true.

## Google ADK and Gemini setup

Set `GEMINI_API_KEY` as a secure environment secret. Google ADK and the Google GenAI SDK are called only from the API service; the key is never exposed to the browser. Normal mode does not fall back to direct source scouting or fixtures when ADK fails.

Each live source-scout and G1–G4 execution exposes only safe runtime evidence: framework, provider, model, ADK invocation ID, declared tools, latency, activity, and completed/failed status. The signal room shows the four stage IDs after a successful run. Prompts, model output, and credentials are not included in that evidence.

For production producer access, configure Clerk server/client secrets and set `publicMetadata.autography_role` to `producer` on authorized users. Local preview role emulation is development-only.

## Local development

- `pnpm --filter @workspace/autography run dev` — web interface
- `pnpm --filter @workspace/api-server run dev` — API service
- `pnpm --filter @workspace/autography test` — frontend component checks
- `pnpm --filter @workspace/api-server test` — API and policy checks using isolated test state
- `pnpm run typecheck` — verify the workspace
- `pnpm --filter @workspace/api-spec run codegen` — regenerate clients and validators after OpenAPI changes

## Deployment readiness

The web and API workflows are configured for Replit and bind through the registered artifacts. Before publishing:

1. Add production Gemini and Clerk secrets in Replit Secrets.
2. Confirm producer roles in the production Clerk tenant.
3. Keep `PODCAST_SYNTHETIC_DEMO` unset or `false`.
4. Run typechecks and both test suites.
5. Publish the registered Autography web and API artifacts through Replit.

This repository includes an MIT license. A public source repository and hosted production URL must still be created or connected when required by a competition submission; this workspace does not claim that either already exists.

## License

MIT. See [LICENSE](LICENSE).