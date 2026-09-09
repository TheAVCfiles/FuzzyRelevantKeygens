---
name: GitHub history reconciliation
description: How to preserve both public GitHub history and a tested Replit checkpoint when their roots are unrelated
---

When GitHub main and the tested Replit branch have unrelated roots, preserve both histories in a two-parent merge. Keep the fully validated Replit tree as the release tree and include the previous GitHub main as the other parent. Never replace public history with a force push.

**Why:** A normal merge ancestry keeps every earlier public commit reachable while allowing the exact tested checkpoint to become the current repository tree.

**How to apply:** Validate before merging, confirm the merge tree is identical to the validated parent, confirm the previous GitHub main is an ancestor, and update main only with a normal fast-forward push.