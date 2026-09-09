import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";

import app from "../app";
import { markPodcastPersistenceReady } from "../lib/podcast-readiness";

markPodcastPersistenceReady();
import {
  claimProductionProducerSeat,
  isProductionProducerBootstrapEligible,
  principalFromVerifiedClerkUser,
  type ProductionProducerSeatDependencies,
} from "./autography";

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

      const bootstrapResponse = await fetch(`${baseUrl}/auth/bootstrap/producer`, {
        method: "POST",
      });
      assert.equal(bootstrapResponse.status, 401);
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalPreviewMode === undefined) delete process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE;
    else process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE = originalPreviewMode;
  }
});

test("verified Clerk users receive only metadata-controlled producer authority", { concurrency: false }, () => {
  const viewer = principalFromVerifiedClerkUser(
    "user_unassigned",
    {},
  );
  assert.equal(viewer.role, "viewer");
  assert.equal(viewer.reviewerId, "user_unassigned");

  const producer = principalFromVerifiedClerkUser(
    "user_verified_producer",
    { autography_role: "producer" },
  );
  assert.equal(producer.role, "producer");
  assert.equal(producer.reviewerId, "user_verified_producer");
});

test("production producer eligibility accepts an explicitly configured Clerk user id", () => {
  assert.equal(
    isProductionProducerBootstrapEligible(
      "user_explicit_owner",
      { publicMetadata: {} },
      { allowedUserIds: "user_other, user_explicit_owner" },
    ),
    true,
  );
});

test("production producer eligibility requires a verified matching primary email", () => {
  const baseUser = {
    publicMetadata: {},
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      {
        id: "email_primary",
        emailAddress: "owner@example.test",
        verificationStatus: "verified",
      },
      {
        id: "email_secondary",
        emailAddress: "secondary@example.test",
        verificationStatus: "verified",
      },
    ],
  };
  const configuration = { allowedEmails: "owner@example.test" };

  assert.equal(
    isProductionProducerBootstrapEligible("user_verified_email", baseUser, configuration),
    true,
  );
  assert.equal(
    isProductionProducerBootstrapEligible(
      "user_unverified_email",
      {
        ...baseUser,
        emailAddresses: [{
          id: "email_primary",
          emailAddress: "owner@example.test",
          verificationStatus: "unverified",
        }],
      },
      configuration,
    ),
    false,
  );
  assert.equal(
    isProductionProducerBootstrapEligible(
      "user_non_primary_email",
      {
        ...baseUser,
        primaryEmailAddressId: "email_primary",
        emailAddresses: [
          {
            id: "email_primary",
            emailAddress: "different@example.test",
            verificationStatus: "verified",
          },
          {
            id: "email_secondary",
            emailAddress: "owner@example.test",
            verificationStatus: "verified",
          },
        ],
      },
      configuration,
    ),
    false,
  );
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

function producerSeatDependencies(
  overrides: Partial<ProductionProducerSeatDependencies> = {},
): ProductionProducerSeatDependencies {
  return {
    getUser: async () => ({ publicMetadata: { workspace: "autography" } }),
    isEligible: () => true,
    tryClaimSeat: async () => "acquired",
    markSeatActive: async () => undefined,
    updateUserMetadata: async () => undefined,
    ...overrides,
  };
}

test("first production producer claim patches only the role and marks the claim active", async () => {
  const updates: Array<{ userId: string; publicMetadata: Record<string, unknown> }> = [];
  const activated: string[] = [];
  const result = await claimProductionProducerSeat(
    "user_first_producer",
    producerSeatDependencies({
      markSeatActive: async (userId) => {
        activated.push(userId);
      },
      updateUserMetadata: async (userId, publicMetadata) => {
        updates.push({ userId, publicMetadata });
      },
    }),
  );

  assert.deepEqual(result, {
    kind: "producer",
    role: "producer",
    reviewer_id: "user_first_producer",
  });
  assert.deepEqual(updates, [{
    userId: "user_first_producer",
    publicMetadata: {
      autography_role: "producer",
    },
  }]);
  assert.deepEqual(activated, ["user_first_producer"]);
});

test("an existing producer closes an unclaimed production seat without rewriting metadata", async () => {
  let claimed = false;
  let activated = false;
  let updated = false;
  const result = await claimProductionProducerSeat(
    "user_existing_producer",
    producerSeatDependencies({
      getUser: async () => ({
        publicMetadata: { autography_role: "producer", workspace: "autography" },
      }),
      tryClaimSeat: async () => {
        claimed = true;
        return "acquired";
      },
      markSeatActive: async () => {
        activated = true;
      },
      updateUserMetadata: async () => {
        updated = true;
      },
    }),
  );

  assert.equal(result.kind, "producer");
  assert.equal(claimed, true);
  assert.equal(activated, true);
  assert.equal(updated, false);
});

test("an ineligible viewer cannot reserve or claim production producer authority", async () => {
  let claimed = false;
  let updated = false;
  const result = await claimProductionProducerSeat(
    "user_ineligible_viewer",
    producerSeatDependencies({
      isEligible: () => false,
      tryClaimSeat: async () => {
        claimed = true;
        return "acquired";
      },
      updateUserMetadata: async () => {
        updated = true;
      },
    }),
  );

  assert.deepEqual(result, { kind: "not_eligible" });
  assert.equal(claimed, false);
  assert.equal(updated, false);
});

test("a second production producer claimant is rejected without a metadata write", async () => {
  let updated = false;
  const result = await claimProductionProducerSeat(
    "user_second_claimant",
    producerSeatDependencies({
      tryClaimSeat: async () => "taken",
      updateUserMetadata: async () => {
        updated = true;
      },
    }),
  );

  assert.deepEqual(result, { kind: "already_claimed" });
  assert.equal(updated, false);
});

test("the same claimant can resume after a failed Clerk metadata update", async () => {
  let attempts = 0;
  let activated = false;
  const dependencies = producerSeatDependencies({
    tryClaimSeat: async () => attempts === 0 ? "acquired" : "owned",
    markSeatActive: async () => {
      activated = true;
    },
    updateUserMetadata: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Clerk metadata unavailable");
    },
  });
  await assert.rejects(
    claimProductionProducerSeat(
      "user_metadata_failure",
      dependencies,
    ),
    /Clerk metadata unavailable/,
  );
  assert.equal(activated, false);

  const resumed = await claimProductionProducerSeat(
    "user_metadata_failure",
    dependencies,
  );
  assert.equal(resumed.kind, "producer");
  assert.equal(attempts, 2);
  assert.equal(activated, true);
});

test("a committed Clerk role survives a lost response without reopening the seat", async () => {
  let roleApplied = false;
  let metadataAttempts = 0;
  let activated = false;
  const dependencies = producerSeatDependencies({
    getUser: async () => ({
      publicMetadata: roleApplied ? { autography_role: "producer" } : {},
    }),
    tryClaimSeat: async () => roleApplied ? "owned" : "acquired",
    markSeatActive: async () => {
      activated = true;
    },
    updateUserMetadata: async () => {
      metadataAttempts += 1;
      roleApplied = true;
      throw new Error("Clerk response lost after commit");
    },
  });

  await assert.rejects(
    claimProductionProducerSeat("user_ambiguous_clerk_failure", dependencies),
    /Clerk response lost after commit/,
  );
  const reconciled = await claimProductionProducerSeat(
    "user_ambiguous_clerk_failure",
    dependencies,
  );
  assert.equal(reconciled.kind, "producer");
  assert.equal(metadataAttempts, 1);
  assert.equal(activated, true);
});

test("a persistence failure grants no producer role", async () => {
  let updated = false;
  await assert.rejects(
    claimProductionProducerSeat(
      "user_persistence_failure",
      producerSeatDependencies({
        tryClaimSeat: async () => {
          throw new Error("Producer claim persistence unavailable");
        },
        updateUserMetadata: async () => {
          updated = true;
        },
      }),
    ),
    /Producer claim persistence unavailable/,
  );
  assert.equal(updated, false);
});