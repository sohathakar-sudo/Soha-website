const fs = require("node:fs");
const { defineConfig, devices } = require("@playwright/test");

// The cloud environment this was built in ships one preinstalled Chromium
// (and no WebKit) whose build number won't match whatever @playwright/test is
// pinned to, so tests point at that binary directly. On a normal machine it
// won't exist — fall back to undefined, which lets Playwright use the browser
// it manages itself (`npx playwright install chromium`).
//
// The "mobile" project is a narrow Chromium viewport rather than a WebKit
// device profile for the same no-WebKit reason.
const candidate = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(candidate) ? candidate : undefined;

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3210",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
        isMobile: false,
        hasTouch: true,
        launchOptions: { executablePath },
      },
    },
  ],
});
