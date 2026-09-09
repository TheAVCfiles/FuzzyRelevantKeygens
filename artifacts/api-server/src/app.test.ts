import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";

import app from "./app";
import { acquirePodcastMutationLock } from "./lib/podcast-fixtures";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("runtime responses have request IDs and safe errors", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-a-route`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
    assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/i);
  });
});

test("runtime rejects malformed and oversized JSON bodies safely", async () => {
  await withServer(async (baseUrl) => {
    const malformed = await fetch(`${baseUrl}/api/not-a-route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "Invalid request." });

    const oversized = await fetch(`${baseUrl}/api/not-a-route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(1_048_576) }),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), {
      error: "Request body exceeds the allowed size.",
    });
  });
});

test("public Cut Key reads are not blocked by an in-flight podcast mutation", async () => {
  await withServer(async (baseUrl) => {
    const lock = await acquirePodcastMutationLock();
    const [manifestResponse, audioResponse] = await Promise.all([
      Promise.race([
        fetch(`${baseUrl}/api/podcast/cut-keys/still-responsive`),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Public Cut Key manifest remained blocked")),
          1_000,
        )),
      ]),
      Promise.race([
        fetch(`${baseUrl}/api/podcast/cut-keys/still-responsive/audio`),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Public Cut Key audio remained blocked")),
          1_000,
        )),
      ]),
    ]);
    lock.release();
    assert.equal(manifestResponse.status, 404);
    assert.equal(audioResponse.status, 404);
  });
});