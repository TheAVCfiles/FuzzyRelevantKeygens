import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getPodcastStorageHealth } from "../lib/podcast-fixtures";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({
    status: "ok",
    storage: getPodcastStorageHealth().status,
  });
  res.json(data);
});

export default router;
