---
name: Podcast audio retention safety
description: The cross-process safety boundary for deleting unreferenced content-addressed podcast audio
---

Destructive podcast audio cleanup must recheck durable PostgreSQL references immediately before deletion and delete only the exact App Storage generation that was inventoried and revalidated. Missing timestamps or generations are ineligible for deletion.

**Why:** The API uploads audio before its publication state is persisted. A state-only check leaves a race where an old object can be replaced between inventory and deletion; a generation precondition makes that overwrite a safe failed delete.

**How to apply:** Protect every retained Cut Key and persisted audio reference, use a retention grace period, refresh object metadata, reload durable state, and require the matching storage generation for the final delete.