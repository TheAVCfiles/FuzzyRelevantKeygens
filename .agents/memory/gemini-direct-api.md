---
name: Gemini direct API model
description: Direct Gemini API model availability and fallback behavior for Autography.
---

Use a current model supported by the direct Google Gemini API when the project is using a user-provided Gemini key. Keep the fixture-backed path available, but record any runtime fallback in the Receipt rather than treating it as a successful model run.

**Why:** Google can retire older models for newly issued API keys even when earlier SDK guidance still names them.

**How to apply:** When a live call returns a model-not-found error, use the current model suggested by the Google response, retest one real request, and leave the deterministic policy path untouched.