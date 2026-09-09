---
name: Legacy comparison presets
description: Transition behavior for ownerless podcast comparison presets after producer ownership was introduced.
---

Legacy ownerless comparison presets remain visible and applicable to every authenticated producer, but producer-scoped mutations must not rename or delete them. Newly created presets always belong to the authenticated producer.

**Why:** Existing shared presets must remain useful during the transition without allowing one producer to alter shared state or another producer's personal presets.

**How to apply:** Any new preset read surface should include ownerless presets plus the current producer's presets. Any authenticated rename or delete path should require an exact owner match.