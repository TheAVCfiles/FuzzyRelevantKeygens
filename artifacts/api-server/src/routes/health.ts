import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getPodcastStorageHealth } from "../lib/podcast-fixtures";
import { getPodcastPersistenceReadiness } from "../lib/podcast-readiness";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const storage = getPodcastStorageHealth().status;
  const readiness = getPodcastPersistenceReadiness().status;
  const data = HealthCheckResponse.parse({
    status: storage === "healthy" && readiness === "ready" ? "ok" : "degraded",
    storage,
    readiness,
  });
  res.json(data);
});

export default router;
