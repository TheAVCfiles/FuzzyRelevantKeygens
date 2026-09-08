import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getPodcastStorageHealth } from "../lib/podcast-fixtures";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const storage = getPodcastStorageHealth().status;
  const data = HealthCheckResponse.parse({
    status: storage === "healthy" ? "ok" : "degraded",
    storage,
  });
  res.json(data);
});

export default router;
