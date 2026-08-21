# Autography

**The signature that writes itself.**

Autography is a synthetic broadcast-control-room experience for the first hours after an episode airs. It reads a flood of signals, distinguishes coordinated amplification from authentic audience concern, stages three scoped moves, and issues only what the subject actually signs.

## Experience

- **The Board** — a live, short-lived Call with a tally light and an expiring permission window.
- **The Constellation** — observed signal clusters with visible coordination indicators, source diversity, and uncertainty; it never reports public opinion.
- **The PR** — three drafted moves, always including **Stay dark**, so silence is a real choice.
- **The Velvet Rope** — a deterministic six-rule policy engine that can refuse an action before anything publishes.
- **The Drop** — a numbered, sealed artifact with visible claim sourcing and a simulated signature manifest.
- **Is this real?** — a public registry lookup for a Drop ID or hash.
- **The Receipt** — an append-only record of reads, evaluations, refusals, signatures, seals, and expiry.

All people, shows, platforms, signals, and records in this demo are synthetic.

## Architecture

- **React + Vite** serves the six product routes and the broadcast-control-room interface.
- **Express** serves the synthetic fixture data, Call clock, Drop registry, receipt ledger, and policy evaluation endpoints.
- **The Velvet Rope** is a pure deterministic rule engine, outside the model path. It enforces window, countersignature, scope, exclusion, evidence, and reach checks in order.
- **Google Gemini** runs a visible four-stage flow: read, classify, reconcile, and draft. Each stage is recorded as `model_inference` in the Receipt. Gemini never approves, issues, or changes policy.
- **Fixture data remains the presentation source of truth**, allowing the demo to remain stable if the Gemini service is unavailable. Any fallback is explicitly recorded.

## Gemini setup

Set `GEMINI_API_KEY` as a secure environment secret. The server calls the Google GenAI SDK only from the API service; the key is never exposed to the browser.

## Local development

- `pnpm --filter @workspace/autography run dev` — web interface
- `pnpm --filter @workspace/api-server run dev` — API service
- `pnpm run typecheck` — verify the workspace

## License

MIT. See [LICENSE](LICENSE).