import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Run against built assets so Vite's real preload-error behavior is exercised.
export default defineConfig({
  ...base,
  testDir: "./e2e-recovery",
  outputDir: "artifacts/recovery-browser-results",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "artifacts/recovery-playwright-report", open: "never" },
    ],
  ],
  use: {
    ...base.use,
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5181",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/recovery-e2e-server.mjs",
        url: "http://127.0.0.1:5181/api/health",
        reuseExistingServer: false,
        timeout: 30000,
      },
});
