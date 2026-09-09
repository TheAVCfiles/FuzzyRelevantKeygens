---
name: Duplicate source recovery
description: Why appended source copies must be removed rather than hidden behind a dead-code guard
---

Remove an accidentally appended source copy completely. Do not treat an `if (false)` wrapper as a durable repair. If removal cannot happen immediately, isolate the duplicate inside a function scope only as a temporary build recovery.

**Why:** TypeScript can accept duplicate function declarations inside a dead-code block while Rollup still reports them as duplicate module declarations during the production build.

**How to apply:** When a file contains a byte-for-byte appended copy, validate both typechecking and the production bundler. Prefer a clean deletion plus a source-duplication validation check.