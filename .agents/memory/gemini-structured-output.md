---
name: Gemini structured output
description: Defensive handling for model responses expected to match structured JSON contracts.
---

Treat a successful Gemini response as untrusted structured input. Validate arrays, objects, enums, and required strings field by field; preserve safe fixture values for malformed or missing fields, and record whether the final draft used live model output or fallback data.

**Why:** A model can return valid JSON with the wrong shape for only some fields, which otherwise turns an apparently successful generation into a server-side contract failure.

**How to apply:** Use this at every server boundary where Gemini output is merged into an OpenAPI/Zod response, especially before recording or presenting a human-reviewable draft.