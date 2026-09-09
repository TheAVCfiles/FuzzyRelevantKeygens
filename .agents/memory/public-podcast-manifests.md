---
name: Public podcast manifests
description: Privacy and integrity rules for podcast Cut Key proof records.
---

Public podcast manifests must contain only the exact transcript/audio identity, bounded source identifiers, generation time, synthetic-production disclosures, and integrity hashes. Their public key is derived from the canonical manifest payload, and lookup must recompute that hash before returning a record.

**Why:** A public verification surface must prove which sample a listener received without exposing reviewer identities, approval history, private attestations, source URLs, validation notes, or producer-room decisions. Persisted tampering must fail closed. PostgreSQL JSONB can reorder nested object properties, so insertion-order JSON serialization is not stable across persistence.

**How to apply:** When changing the Cut Key payload, update the canonical serializer and public contract together. Rebuild every nested object in a fixed property order before hashing, and test reordered-but-equivalent objects. Any unhashed derived field, such as the playback URL, must be reconstructed or strictly validated against the key. Keep approval-chain checks on the authenticated release path, not in the public manifest.