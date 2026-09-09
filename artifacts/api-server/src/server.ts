import type { Server } from "node:http";
import app from "./app";
import { initializePodcastPersistence } from "./lib/podcast-fixtures";
import { logger } from "./lib/logger";
import {
  markPodcastPersistenceFailed,
  markPodcastPersistenceInitializing,
  markPodcastPersistenceReady,
} from "./lib/podcast-readiness";

type StartApiServerOptions = {
  host?: string;
  initializePersistence?: () => Promise<void>;
};

export type StartedApiServer = {
  server: Server;
  initialization: Promise<"ready" | "failed">;
};

export function startApiServer(
  port: number,
  options: StartApiServerOptions = {},
): StartedApiServer {
  const initializePersistence =
    options.initializePersistence ?? initializePodcastPersistence;
  markPodcastPersistenceInitializing();

  let beginInitialization!: () => void;
  const listening = new Promise<void>((resolve) => {
    beginInitialization = resolve;
  });
  const onListening = () => {
    logger.info({ port }, "Server listening");
    beginInitialization();
  };
  const server = options.host
    ? app.listen(port, options.host, onListening)
    : app.listen(port, onListening);

  // Keep connections bounded while allowing audio streams and normal API calls
  // enough time to complete on slower clients.
  server.requestTimeout = 120_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 5_000;

  const initialization = listening.then(async () => {
    try {
      await initializePersistence();
      markPodcastPersistenceReady();
      logger.info("Podcast durable persistence is ready");
      return "ready" as const;
    } catch {
      markPodcastPersistenceFailed();
      return "failed" as const;
    }
  });

  return { server, initialization };
}