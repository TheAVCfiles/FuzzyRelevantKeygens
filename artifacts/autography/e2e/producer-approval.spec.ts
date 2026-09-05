import { createClerkClient } from '@clerk/backend';
import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey) {
  throw new Error('CLERK_SECRET_KEY is required for the producer approval E2E test.');
}

const clerkClient = createClerkClient({ secretKey });

test('a verified Clerk producer signs and is named in the receipt', async ({ page }) => {
  const email = `producer-${Date.now()}@example.com`;
  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    firstName: 'Producer',
    lastName: 'Approval Test',
    password: 'Autography_Test_Producer_42!',
    publicMetadata: { autography_role: 'producer' },
  });

  try {
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: email });

    const me = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me');
      return { status: response.status, body: await response.json() };
    });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      role: 'producer',
      reviewer_id: user.id,
      source: 'verified_session',
    });

    const result = await page.evaluate(async () => {
      const roomResponse = await fetch('/api/podcast/sources');
      const room = await roomResponse.json();
      const concept = room.concepts[0];

      const planResponse = await fetch('/api/podcast/development', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          concept_id: concept.id,
          source_ids: concept.source_ids,
          audience: 'consumers',
          use_case: 'cultural_context',
        }),
      });
      const plan = await planResponse.json();

      const validationResponse = await fetch(
        `/api/podcast/development/${plan.id}/validation`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            decision: 'validate',
            archetype_id: plan.archetypes[0].id,
            format_id: plan.format_variants[0].id,
          }),
        },
      );

      const receiptsResponse = await fetch('/api/receipts');
      const receipts = await receiptsResponse.json();
      const receipt = receipts.find((item: { action?: string; actor?: string }) =>
        item.action === 'Podcast development validate decision',
      );

      return {
        roomStatus: roomResponse.status,
        planStatus: planResponse.status,
        validationStatus: validationResponse.status,
        receiptsStatus: receiptsResponse.status,
        receipt,
      };
    });

    expect(result.roomStatus).toBe(200);
    expect(result.planStatus).toBe(201);
    expect(result.validationStatus).toBe(200);
    expect(result.receiptsStatus).toBe(200);
    expect(result.receipt?.actor).toBe(user.id);
  } finally {
    await clerkClient.users.deleteUser(user.id);
  }
});