---
name: Generated contract resolution
description: A type-resolution quirk affecting API packages that reference generated library declarations
---

When an API package directly typechecks against a referenced generated library, its compiler can resolve stale ignored declarations until the library is rebuilt. Server-side compatibility-sensitive types should make required persisted fields explicit locally rather than depending on generated output having been rebuilt first.

**Why:** A shared source contract can contain a newly required field while the API package still sees an older declaration from the ignored build directory, causing direct package typechecks to fail or become dependent on command order.

**How to apply:** Keep the shared OpenAPI/generated source contract authoritative, and use a strict local intersection type for API persistence boundaries when direct package checks must remain reliable.