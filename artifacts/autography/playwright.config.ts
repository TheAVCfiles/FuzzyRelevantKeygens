import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const baseURL = process.env.E2E_BASE_URL
  ?? (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

if (!baseURL) {
  throw new Error('E2E_BASE_URL or REPLIT_DEV_DOMAIN is required.');
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    launchOptions: {
      executablePath: execFileSync('which', ['chromium'], {
        encoding: 'utf8',
      }).trim(),
    },
    trace: 'retain-on-failure',
  },
});