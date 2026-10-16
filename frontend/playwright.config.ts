import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database =
  process.env.E2E_DATABASE_URL ??
  "postgresql://lup:lup_local_only@localhost:5432/lup_test";
if (!new URL(database).pathname.endsWith("/lup_test"))
  throw new Error("E2E must use lup_test");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "npm run dev:api",
      cwd: root,
      url: "http://localhost:3000/api/health",
      reuseExistingServer: false,
      env: {
        NODE_ENV: "development",
        DATABASE_URL: database,
        DIRECT_URL: database,
        MAIL_MODE: "local",
        WEB_ORIGINS: "http://localhost:5173",
        PUBLIC_WEB_URL: "http://localhost:5173",
        LOCAL_OUTBOX_DIR: ".local/e2e-outbox",
      },
      timeout: 60000,
    },
    {
      command: "npm run dev:web",
      cwd: root,
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
