import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { startApiServer } from "./server";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function closeServer(server: ReturnType<typeof startApiServer>["server"]) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("startup stays live while podcast persistence initializes, then becomes ready", async () => {
  const persistence = deferred();
  const started = startApiServer(0, {
    host: "127.0.0.1",
    initializePersistence: () => persistence.promise,
  });
  await once(started.server, "listening");

  try {
    const address = started.server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthWhileInitializing = await fetch(`${baseUrl}/api/healthz`);
    assert.equal(healthWhileInitializing.status, 200);
    assert.deepEqual(await healthWhileInitializing.json(), {
      status: "degraded",
      storage: "healthy",
      readiness: "initializing",
    });

    const publicReadWhileInitializing = await fetch(
      `${baseUrl}/api/podcast/cut-keys/not-real`,
    );
    assert.equal(publicReadWhileInitializing.status, 503);
    assert.deepEqual(await publicReadWhileInitializing.json(), {
      error: "Podcast storage is not ready.",
      readiness: "initializing",
    });

    const mutationWhileInitializing = await fetch(`${baseUrl}/api/podcast/reset`, {
      method: "POST",
    });
    assert.equal(mutationWhileInitializing.status, 503);

    persistence.resolve();
    assert.equal(await started.initialization, "ready");

    const healthWhenReady = await fetch(`${baseUrl}/api/healthz`);
    assert.equal(healthWhenReady.status, 200);
    assert.deepEqual(await healthWhenReady.json(), {
      status: "ok",
      storage: "healthy",
      readiness: "ready",
    });

    const publicReadWhenReady = await fetch(
      `${baseUrl}/api/podcast/cut-keys/not-real`,
    );
    assert.equal(publicReadWhenReady.status, 404);
  } finally {
    await closeServer(started.server);
  }
});

test("failed persistence remains live and fail-closed without exposing the failure", async () => {
  const started = startApiServer(0, {
    host: "127.0.0.1",
    initializePersistence: async () => {
      throw new Error("DATABASE_URL=must-not-be-returned");
    },
  });
  await once(started.server, "listening");

  try {
    assert.equal(await started.initialization, "failed");
    const address = started.server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/api/healthz`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.deepEqual(healthBody, {
      status: "degraded",
      storage: "healthy",
      readiness: "failed",
    });
    assert.equal(JSON.stringify(healthBody).includes("must-not-be-returned"), false);

    const podcastResponse = await fetch(`${baseUrl}/api/podcast/room`);
    assert.equal(podcastResponse.status, 503);
    const podcastBody = await podcastResponse.json();
    assert.deepEqual(podcastBody, {
      error: "Podcast storage is not ready.",
      readiness: "failed",
    });
    assert.equal(JSON.stringify(podcastBody).includes("must-not-be-returned"), false);
  } finally {
    await closeServer(started.server);
  }
});