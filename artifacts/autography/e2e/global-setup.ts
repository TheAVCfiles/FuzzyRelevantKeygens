import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup() {
  await clerkSetup({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
}