const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  webServer: {
    command: "python3 -m http.server 8080",
    port: 8080,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:8080",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
