import app from "./app";
import { logger } from "./lib/logger";
import { initializePodcastPersistence } from "./lib/podcast-fixtures";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initializePodcastPersistence();

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// Keep connections bounded while allowing audio streams and normal API calls
// enough time to complete on slower clients.
server.requestTimeout = 120_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 5_000;
