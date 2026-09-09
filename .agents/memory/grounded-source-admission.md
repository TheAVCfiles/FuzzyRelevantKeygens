---
name: Grounded source admission
description: Privacy and factual-support rules that must pass before a live grounded source run is persisted.
---

Treat a canonical source URL as retained data, not merely a locator. Exclude a social result when its public path embeds an account identifier, copied post title, or other identity-bearing text. Treat each editorial source summary as a concrete claim and independently verify it against only that source's grounding evidence before persisting the run.

**Why:** A live search can resolve real publishers and still leak a handle or copied post slug through the canonical URL. A privacy-safe paraphrase can also introduce plausible but unsupported implications that later script verification cannot detect if it trusts the paraphrase as source evidence.

**How to apply:** Perform URL privacy checks and source-finding support verification before a grounded run becomes current or durable. Keep failed attempts out of script, audio, and Cut Key flows, and never relax date or domain-diversity gates to force a proof.