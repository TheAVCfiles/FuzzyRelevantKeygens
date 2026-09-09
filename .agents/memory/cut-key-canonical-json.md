---
name: Cut Key canonical JSON
description: Why public manifest hashes must normalize nested evidence objects before hashing.
---

Canonical integrity payloads must reconstruct every nested source-evidence object in a fixed field order before hashing or revalidation.

**Why:** PostgreSQL JSONB may reorder object keys when a manifest is persisted. Hashing a nested object as-is can make a correctly stored Cut Key fail validation after a database round-trip even though its values are unchanged.

**How to apply:** Whenever a field is added to a Cut Key’s nested evidence, add it explicitly to the canonical payload constructor and cover a round-trip where nested keys arrive in a different order.