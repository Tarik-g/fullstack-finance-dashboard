import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.E2E_PYTHON;
if (!python || !process.env.E2E_DATABASE_URL || !process.env.E2E_RUN_ID) {
  throw new Error(
    "Use npm run test:e2e so an isolated test database is created first.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      name: "E2E API",
      command: `"${python}" "${path.join(root, "tests/e2e/server.py")}"`,
      cwd: root,
      url: "http://127.0.0.1:8001/api/v1/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      name: "E2E frontend",
      command:
        "npm run build -- --outDir .e2e-dist && npm run preview -- --outDir .e2e-dist --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      env: { VITE_API_BASE_URL: "http://127.0.0.1:8001" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
