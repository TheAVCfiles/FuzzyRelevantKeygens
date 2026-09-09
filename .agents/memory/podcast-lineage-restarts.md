---
name: Podcast lineage across restarts
description: Why podcast provenance and storage isolation must be verified after process rehydration.
---

Bind every generated brief, script, audio clip, and public manifest to immutable run and attestation identities, and require the complete approval chain again at the final authority boundary. Keep test storage physically separate from the running demo.

**Why:** In-process success can hide incorrect restored lookup keys or latest-run selection, while a test suite sharing development storage can erase the only live verification artifact. Both failures compromise the trust story even when generation itself succeeds.

**How to apply:** Whenever podcast persistence, provenance, approval, or audio routing changes, exercise at least one exact artifact across an API restart and confirm its signed-out manifest, current-only audio, and hash still agree. Run automated tests against unique temporary state and audio paths.