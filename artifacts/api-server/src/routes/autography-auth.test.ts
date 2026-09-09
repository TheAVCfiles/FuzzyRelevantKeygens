import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";

import app from "../app";
import { markPodcastPersistenceReady } from "../lib/podcast-readiness";

markPodcastPersistenceReady();
import { principalFromVerifiedClerkUser } from "./autography";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("shared environments ignore caller-supplied producer headers", { concurrency: false }, async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPreviewMode = process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE;
  process.env.NODE_ENV = "production";
  delete process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE;
  try {
    await withServer(async (baseUrl) => {
      const publicJudgeResponse = await fetch(`${baseUrl}/podcast/judge-manifest`);
      assert.equal(publicJudgeResponse.status, 404);

      const response = await fetch(`${baseUrl}/podcast/sources`, {
        headers: {
          "x-autography-role": "producer",
          "x-autography-user": "spoofed-reviewer",
        },
      });
      assert.equal(response.status, 401);

      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "producer", user_id: "spoofed-reviewer" }),
      });
      assert.equal(sessionResponse.status, 401);

      const legacyTokenResponse = await fetch(`${baseUrl}/podcast/sources`, {
        headers: {
          Authorization: "Bearer pilot:v1:producer:legacy-preview-producer:9999999999999:spoofed",
        },
      });
      assert.equal(legacyTokenResponse.status, 401);
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalPreviewMode === undefined) delete process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE;
    else process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE = originalPreviewMode;
  }
});

test("verified Clerk users require server-controlled producer metadata", { concurrency: false }, () => {
  const viewer = principalFromVerifiedClerkUser("user_unassigned", {});
  assert.equal(viewer.role, "viewer");
  assert.equal(viewer.reviewerId, "user_unassigned");

  const producer = principalFromVerifiedClerkUser(
    "user_verified_producer",
    { autography_role: "producer" },
  );
  assert.equal(producer.role, "producer");
  assert.equal(producer.reviewerId, "user_verified_producer");
});

test("preview headers work only with the explicit development-only flag", { concurrency: false }, async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPreviewMode = process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE;
  process.env.NODE_ENV = "development";
  process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE = "true";
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/podcast/sources`, {
        headers: {
          "x-autography-role": "producer",
          "x-autography-user": "preview-producer",
        },
      });
      assert.equal(response.status, 200);
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalPreviewMode === undefined) delete process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE;
    else process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE = originalPreviewMode;
  }
});