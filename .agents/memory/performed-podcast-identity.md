---
name: Performed podcast identity
description: Product rules for turning approved editorial inputs into a changing synthetic podcast sample
---

Podcast samples must contain finished spoken entertainment copy, never production directions copied from development-plan fields. A change to the approved format or fictional archetype must invalidate any reusable script/audio identity and produce a meaningfully changed sample.

**Why:** A sample can be labeled “performed” yet still sound like an audiobook if imperatives such as “open with” or “ask” leak from planning metadata. Reusing output by concept and sources alone also makes producer choices appear ineffective.

**How to apply:** Treat format, fictional archetype, topic angle, title, and evidence set as part of podcast content identity. Test the same evidence with format-only and archetype-only changes, and keep non-impersonation disclosures intact.

Long-running audio generation must also capture a unique workspace incarnation, not only a content fingerprint. Re-check that incarnation after the model returns so an A → B → A editorial sequence cannot attach an obsolete response to a newly recreated, identical-looking workspace.

**Why:** Deterministic script IDs and identical copy are insufficient to distinguish an old in-flight render from a newly approved replacement.

**How to apply:** Assign a fresh persisted revision when a script workspace is created or legacy state is normalized, preserve it through decisions, and require the captured revision to match immediately before committing generated media.