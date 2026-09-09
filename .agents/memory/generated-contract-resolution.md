---
name: Generated contract resolution
description: A type-resolution quirk affecting API packages that reference generated library declarations
---

When an API package directly typechecks against a referenced generated library, its compiler can resolve stale ignored declarations until the library is rebuilt. Server-side compatibility-sensitive types should make required persisted fields explicit locally rather than depending on generated output having been rebuilt first.

**Why:** A shared source contract can contain a newly required field while the API package still sees an older declaration from the ignored build directory, causing direct package typechecks to fail or become dependent on command order.

**How to apply:** Keep the shared OpenAPI/generated source contract authoritative, and use a strict local intersection type for API persistence boundaries when direct package checks must remain reliable.

This workspace's current OpenAPI-to-Zod generator emits `zod.int()` for `type: integer`, but the installed Zod version does not expose that API.

**Why:** Contract generation can succeed while the generated-library typecheck immediately fails, even though the intended values are ordinary bounded numeric scores or counts.

**How to apply:** For numeric API fields in this workspace, prefer `type: number` plus explicit bounds when integer-only parsing is not essential; regenerate and run the library typecheck before consuming new hooks or validators.