import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";

import app from "./app";
import { acquirePodcastMutationLock } from "./lib/podcast-fixtures";
import { markPodcastPersistenceReady } from "./lib/podcast-readiness";

markPodcastPersistenceReady();

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

test("live observation API rejects unapproved envelopes and preserves only safe provenance", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const headers = {
      "content-type": "application/json",
      "x-autography-role": "producer",
      "x-autography-user": "live-source-regression",
    };
    const observedAt = new Date(Date.now() - 2 * 60_000).toISOString();
    const windowStart = new Date(Date.now() - 5 * 60_000).toISOString();
    const windowEnd = new Date(Date.now() - 60_000).toISOString();
    const rawText = "RAW-LIVE-CONTENT-MUST-NOT-BE-RETURNED";
    const resolvableHandle = "resolvable-person-handle";
    const approvedEnvelope = {
      source_id: "consented-newsroom-v1",
      source_class: "consented_newsroom",
      consent_ref: "consent-live-source-regression",
      policy_review_ref: "policy-live-source-regression",
      observations: [{
        id: "live-source-regression-observation",
        text: rawText,
        observed_at: observedAt,
        observation_window: { start: windowStart, end: windowEnd },
        confidence: "high",
        author: {
          handle: resolvableHandle,
          profile_url: "https://example.test/people/resolvable-person",
        },
      }],
    };

    for (const unapprovedEnvelope of [
      { ...approvedEnvelope, source_id: "unapproved-newsroom" },
      { ...approvedEnvelope, source_class: "pseudonymous_social" },
    ]) {
      const rejected = await fetch(`${baseUrl}/api/flood/observations`, {
        method: "POST",
        headers,
        body: JSON.stringify(unapprovedEnvelope),
      });
      assert.equal(rejected.status, 400);
    }

    const accepted = await fetch(`${baseUrl}/api/flood/observations`, {
      method: "POST",
      headers,
      body: JSON.stringify(approvedEnvelope),
    });
    assert.equal(accepted.status, 202);
    const receipt = await accepted.json() as {
      accepted: boolean;
      source_id: string;
      flood: {
        events: Array<{
          text: string;
          author: { handle: string; account_age_days: number; followers: number };
          provenance: {
            source_id: string;
            source_class: string;
            consent_ref: string;
            observation_window: { start: string; end: string };
            freshness: string;
            confidence: string;
          };
        }>;
      };
    };

    assert.equal(receipt.accepted, true);
    assert.equal(receipt.source_id, approvedEnvelope.source_id);
    assert.equal(receipt.flood.events.length, 1);
    const event = receipt.flood.events[0];
    assert.ok(event);
    assert.equal(event.provenance.source_id, approvedEnvelope.source_id);
    assert.equal(event.provenance.source_class, approvedEnvelope.source_class);
    assert.equal(event.provenance.consent_ref, approvedEnvelope.consent_ref);
    assert.deepEqual(event.provenance.observation_window, {
      start: windowStart,
      end: windowEnd,
    });
    assert.match(event.provenance.freshness, /^\d+m old$/);
    assert.equal(event.provenance.confidence, "high");
    assert.equal(event.text, "[grouped observation withheld from amplification]");
    assert.deepEqual(event.author, {
      handle: "identity unavailable",
      account_age_days: 0,
      followers: 0,
    });

    const serializedReceipt = JSON.stringify(receipt);
    assert.equal(serializedReceipt.includes(rawText), false);
    assert.equal(serializedReceipt.includes(resolvableHandle), false);
    assert.equal(serializedReceipt.includes("profile_url"), false);

    const liveResponse = await fetch(`${baseUrl}/api/flood?source=live`, { headers });
    assert.equal(liveResponse.status, 200);
    const serializedLiveResponse = await liveResponse.text();
    assert.equal(serializedLiveResponse.includes(rawText), false);
    assert.equal(serializedLiveResponse.includes(resolvableHandle), false);
    assert.equal(serializedLiveResponse.includes("profile_url"), false);
    const liveFlood = JSON.parse(serializedLiveResponse);
    assert.deepEqual(liveFlood.events[0].provenance, event.provenance);
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