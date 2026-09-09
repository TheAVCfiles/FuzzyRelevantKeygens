# Autography

**The signature that writes itself.**

Autography is a cinematic, safety-first entertainment response and podcast-development workspace. It combines live public-source grounding, deterministic policy checks, and explicit human approvals so a producer can move quickly without hiding uncertainty or surrendering editorial authority.

- Hosted app: https://fuzzy-relevant-keygens.replit.app
- Source history: built and iterated with Replit Agent; the reconciled Git history retains both the tested Replit checkpoint and the earlier public GitHub commits.
- License: MIT

## Experience

- **The Board** — a live, short-lived Call with a tally light and an expiring permission window.
- **The Constellation** — observed signal clusters with visible coordination indicators, source diversity, and uncertainty; it never reports public opinion.
- **The PR** — three drafted moves, always including **Stay dark**, so silence is a real choice.
- **The Velvet Rope** — a deterministic six-rule policy engine that can refuse an action before anything publishes.
- **The Drop** — a numbered, sealed artifact with visible claim sourcing and a simulated signature manifest.
- **Is this real?** — a public registry lookup for a Drop ID or hash.
- **The Receipt** — an append-only record of reads, evaluations, refusals, signatures, seals, and expiry.
- **The Podcast Desk** — one gated path from a current entertainment question to an approved two-host audio cut.
- **The Cut Key** — a signed-out, podcast-specific integrity manifest with citations, authority records, execution metadata, line mappings, and hashes.

The Board, PR, Drop, and Receipt scenarios use clearly labeled synthetic fixtures. The Podcast Desk runs live by default and labels synthetic data only when explicit demo mode is enabled.

## Podcast golden path

1. A producer enters a keyword, genre, or current entertainment question.
2. A Google ADK `LlmAgent` invokes Google Search grounding to retrieve 3–5 current public sources.
3. The desk displays source titles, URLs, retrieval times, source types, support boundaries, and unresolved questions.
4. The producer explicitly adds authorized private cutting-room context or declines it.
5. A human validates the episode angle and format, then approves the brief.
6. Gemini generates fresh dialogue for the fictional house voices **FRONT ROW** and **BACKSTAGE**.
7. One **Approve exact script and perform** action atomically records distinct `SCRIPT_APPROVED` and `AUDIO_RENDER_AUTHORIZED` authority records for the same reviewer, timestamp, script hash, source run, policy version, and ADK parent.
8. Gemini multi-speaker speech renders that exact approved script with distinct Kore and Puck voices.
9. A public Cut Key exposes privacy-safe lineage for the exact audio artifact while publication remains separately blocked pending final approval.

Normal mode fails closed when live retrieval, structured generation, authority matching, or speech rendering fails. It never silently substitutes fixtures.

## Architecture

- **React + Vite** serves the authenticated editorial workspace and public verification routes.
- **Express** serves domain state, approval gates, the Drop registry, the receipt ledger, public Cut Keys, and audio streaming.
- **The Velvet Rope** is a pure deterministic rule engine, outside the model path. It enforces window, countersignature, scope, exclusion, evidence, and reach checks in order.
- **Google ADK via `@google/adk` 2.0.0** runs the live Search-grounded podcast source scout and the G1–G4 read, classify, reconcile, and draft orchestration with real `LlmAgent` and `InMemoryRunner` invocations.
- **Google Gemini via `@google/genai`** performs bounded podcast evidence editing, brief generation, script generation, and multi-speaker speech after the ADK scout.
- **OpenAPI + Orval + Zod** keep browser hooks and server validators generated from one contract.
- **Human approvals and deterministic authority checks** stay outside the model path. Gemini cannot approve, authorize publication, or relax policy.
- **Per-artifact binding** carries the exact grounded run, citations, attestation, authority records, ADK parent, script execution, Gemini speech execution, and hashes through the Cut Key.

### Vertex AI evidence boundary

The current non-secret runtime evidence identifies the framework as Google ADK and the provider as `Google Gemini API`. The runtime is configured with `GEMINI_API_KEY`; no Vertex project or location configuration is present. `@google-cloud/vertexai` is installed transitively by `@google/adk`, and the source validator accepts canonical `vertexaisearch.cloud.google.com` grounding redirect URLs. This checkpoint does not claim a separately deployed Vertex AI Agent Engine resource because none was verified.

## Runtime modes

- `Live Google ADK` — normal runtime with a real ADK source-scout invocation, Google Search grounding, and downstream Gemini generation.
- Retained `Live Gemini` runs remain readable and can complete their already-bound approval path for backward compatibility.
- `Synthetic Demo` — available only when `PODCAST_SYNTHETIC_DEMO=true`; every surface labels it.
- `Failed` — live failure state. No fixture artifact is created.

Cut Key hashes prove integrity and attribution for the rendered artifact. They do not prove that every source claim is true.

## Google ADK and Gemini setup

Set `GEMINI_API_KEY` as a secure environment secret. Google ADK and the Google GenAI SDK are called only from the API service; the key is never exposed to the browser. Normal Podcast Room mode does not fall back to direct source scouting or fixtures when ADK fails.

Each live ADK execution exposes only safe runtime evidence: framework, provider, model, invocation ID, declared tools, latency, activity, and completed/failed status. Prompts, model output, credentials, private cutting-room text, and reviewer identity are excluded from public Cut Keys.

For producer access, configure Clerk server/client secrets and set `publicMetadata.autography_role` to `producer` on authorized users. Local preview role emulation is development-only.

## Local development and validation

- `pnpm --filter @workspace/autography run dev` — web interface
- `pnpm --filter @workspace/api-server run dev` — API service
- `pnpm --filter @workspace/api-spec run codegen` — regenerate clients and validators after OpenAPI changes
- `pnpm run validate:release` — full contract, typecheck, API test, frontend test, and production-build validation

## Deployment status

The current public URL is https://fuzzy-relevant-keygens.replit.app. This release-evidence sync updates GitHub only; it does not publish a new Replit deployment.

Before a later Replit publish:

1. Confirm production Gemini and Clerk secrets are configured.
2. Confirm producer roles in the production Clerk tenant.
3. Keep `PODCAST_SYNTHETIC_DEMO` unset or `false`.
4. Run `pnpm run validate:release`.
5. Publish the registered Autography web and API artifacts through Replit.

## License

MIT. See [LICENSE](LICENSE).