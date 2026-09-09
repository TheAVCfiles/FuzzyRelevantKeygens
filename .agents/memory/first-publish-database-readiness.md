---
name: First-publish database readiness
description: Why API liveness must not wait for managed production database hydration during a first publish.
---

Open the HTTP port before starting durable podcast hydration, but keep every podcast route unavailable until hydration succeeds. Expose only a safe lifecycle state from health checks while storage is initializing or failed.

**Why:** A first Replit production publish can start the runnable artifact before the managed production database is ready. Waiting for the first database query before listening creates a promotion deadlock: the required port never opens, so publishing cannot finish provisioning the environment.

**How to apply:** Treat process liveness and podcast storage readiness separately. Never use fixture or in-memory podcast data as a production startup fallback, and never mark readiness successful after rejected persisted state.