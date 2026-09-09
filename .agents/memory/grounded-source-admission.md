---
name: Grounded source admission
description: Privacy and factual-support rules that must pass before a live grounded source run is persisted.
---

Treat a canonical source URL as retained data, not merely a locator. Exclude a social result when its public path embeds an account identifier, copied post title, or other identity-bearing text. Treat each editorial source summary as a concrete claim and independently verify it against only that source's grounding evidence before persisting the run.

Do not copy a raw search query into a public concept title. A query may contain a canonical URL or community path that correctly fails public-text validation after persistence rehydration.

**Why:** A live search can resolve real publishers and still leak identity-bearing text or resolve to an unrelated mutable social post. Query text can also silently downgrade an otherwise valid run during rehydration.

**How to apply:** Perform URL privacy, topic relevance, and source-finding support checks before a grounded run becomes current or durable. Keep failed attempts out of script, audio, and judge-selected Cut Key flows.