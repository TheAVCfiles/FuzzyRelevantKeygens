import type { NextFunction, Request, Response } from "express";

export type PodcastPersistenceReadiness = "initializing" | "ready" | "failed";

let podcastPersistenceReadiness: PodcastPersistenceReadiness = "initializing";

export function getPodcastPersistenceReadiness() {
  return { status: podcastPersistenceReadiness } as const;
}

export function markPodcastPersistenceInitializing() {
  podcastPersistenceReadiness = "initializing";
}

export function markPodcastPersistenceReady() {
  podcastPersistenceReadiness = "ready";
}

export function markPodcastPersistenceFailed() {
  podcastPersistenceReadiness = "failed";
}

export function requirePodcastPersistenceReady(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const readiness = getPodcastPersistenceReadiness().status;
  if (readiness === "ready") {
    next();
    return;
  }
  res.status(503).json({
    error: "Podcast storage is not ready.",
    readiness,
  });
}