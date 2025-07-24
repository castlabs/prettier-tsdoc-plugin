import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run build before tests to ensure dist/ exists
    globalSetup: ['./vitest.setup.ts'],
  },
});
