import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

import { runBrowserCoverage } from "./smoke-accessibility.test.mjs";
import { runRamadanReadinessCoverage } from "./ramadan-readiness.test.mjs";
import { runHeroNextPrayerBackgroundCoverage } from "./hero-next-prayer-backgrounds.test.mjs";

const port = 3197;
const server = spawn(process.execPath, ["tests/browser/static-server.mjs", "src", String(port)], {
  stdio: "ignore",
});

async function waitForServer(url) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`browser test server did not start at ${url}`);
}

let browser;
try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseUrl}/index.html`);

  for (const channel of ["chrome", "msedge"]) {
    try {
      browser = await chromium.launch({ channel, headless: true });
      break;
    } catch (error) {
      if (channel === "msedge") throw error;
    }
  }

  await runBrowserCoverage(browser, baseUrl);
  await runRamadanReadinessCoverage(browser, baseUrl);
  await runHeroNextPrayerBackgroundCoverage(browser, baseUrl);
} finally {
  if (browser) await browser.close();
  server.kill();
}
