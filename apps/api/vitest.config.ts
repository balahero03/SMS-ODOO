import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globalSetup: "./tests/global-setup.ts",
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://sms:sms@localhost:5434/sms_test",
      JWT_SECRET: "test-secret-test-secret-test-secret-1234",
    },
  },
});
