import { CANONICAL_TIMINGS, makeMonthCalendar } from "../fixtures/calendar.mjs";

const viewports = [
  { name: "mobile-430", width: 430, height: 800 },
  { name: "mobile-414", width: 414, height: 800 },
  { name: "mobile-390", width: 390, height: 800 },
  { name: "mobile-375", width: 375, height: 800 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-320", width: 320, height: 800 },
  { name: "tablet-600", width: 600, height: 900 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "desktop-900", width: 900, height: 900 },
  { name: "desktop-1024", width: 1024, height: 900 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1000 },
  { name: "landscape-844", width: 844, height: 390 },
  { name: "landscape-740", width: 740, height: 360 },
];

export async function runBrowserCoverage(browser, baseUrl) {
  const results = [];
  const check = (id, pass, detail = "") => {
    results.push({ id, pass });
    console.log(`${pass ? "PASS" : "FAIL"} ${id}${detail ? ` ${detail}` : ""}`);
  };

  const context = await browser.newContext({ viewport: viewports[0] });
  let calendarRequests = 0;
  await context.route("https://api.aladhan.com/v1/**", async (route) => {
      calendarRequests += 1;
      const url = new URL(route.request().url());
      const payload = makeMonthCalendar({
        year: Number(url.searchParams.get("year")),
        month: Number(url.searchParams.get("month")),
        hijriDayOffset: 11,
        timesFor: () => CANONICAL_TIMINGS,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: payload }),
      });
  });
  await context.route("**/api/geocode*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, results: [] }),
  }));

  const page = await context.newPage();
  let consoleErrors = [];
  let pageErrors = [];
  let badResponses = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-weekly-data] .schedule-table-card", { timeout: 30_000 });
  await page.waitForSelector("[data-daily-data] .daily-prayer-card", { timeout: 30_000 });
  await page.waitForFunction(() => /[0-9]/.test(document.querySelector("[data-qibla-deg]")?.textContent || ""));
  await page.waitForFunction(() => /[0-9]/.test(document.querySelector("[data-ramadan-day]")?.textContent || ""));
  await page.waitForTimeout(300);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    consoleErrors = [];
    pageErrors = [];
    badResponses = [];

    const state = await page.evaluate(() => {
      const ids = ["site-header", "hero-section", "prayer-section", "weekly-prayer-section", "qibla-section", "ramadan-section", "site-footer"];
      const weeklyTable = getComputedStyle(document.querySelector(".weekly-prayer-section .schedule-table-wrap")).display;
      const weeklyMobile = getComputedStyle(document.querySelector(".weekly-prayer-section .weekly-table-mobile-list")).display;
      const weeklySelector = document.querySelector(".weekly-table-mobile-selector");
      const weeklySelectorDisplay = getComputedStyle(weeklySelector).display;
      const weeklyMobileCardCount = document.querySelectorAll(".weekly-prayer-section .weekly-table-mobile-card").length;
      const weeklyTimeCount = document.querySelectorAll(".weekly-prayer-section .weekly-table-mobile-card time[dir='ltr']").length;
      const weeklyGridColumns = getComputedStyle(document.querySelector(".weekly-prayer-section .weekly-table-mobile-grid")).gridTemplateColumns.split(" ").filter(Boolean).length;
      const ramadanTable = getComputedStyle(document.querySelector(".ramadan-month-table-section .schedule-table-wrap")).display;
      const ramadanMobile = getComputedStyle(document.querySelector(".ramadan-month-table-section .weekly-table-mobile-list")).display;
      const countdown = document.querySelector("[data-hero-countdown]");
      let liveAncestor = false;
      for (let node = countdown; node && node !== document.body; node = node.parentElement) {
        liveAncestor ||= node.hasAttribute("aria-live") || node.getAttribute("role") === "status";
      }
      return {
        singleMount: ids.every((id) => document.querySelectorAll(`#${id}`).length === 1),
        sectionsReady: document.querySelectorAll("[data-weekly-data] tbody tr").length >= 7 && document.querySelectorAll("[data-daily-data] .daily-prayer-card").length >= 5,
        noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        responsive: innerWidth <= 575 ? weeklyTable === "none" && weeklyMobile !== "none" && weeklySelectorDisplay !== "none" && weeklyMobileCardCount === 1 && ramadanTable === "none" && ramadanMobile !== "none" : weeklyTable !== "none" && weeklyMobile === "none" && weeklySelectorDisplay === "none" && ramadanTable !== "none" && ramadanMobile === "none",
        mobileContent: innerWidth <= 575 ? weeklyTimeCount === 5 && (innerWidth <= 335 ? weeklyGridColumns === 1 : weeklyGridColumns === 2) : true,
        accessible: !liveAncestor && Boolean(document.querySelector("[data-hero-live-status]")) && document.querySelector("label[for='weekly-day-select']")?.textContent === "اختيار اليوم" && document.querySelector("[data-weekly-day-select]")?.getAttribute("aria-label") === "اختيار اليوم" && document.querySelectorAll(".daily-prayer-card[aria-current='true']").length === 1 && /^اتجاه القبلة بزاوية \d+°$/.test(document.querySelector("[data-qibla-compass]")?.getAttribute("aria-label") || ""),
      };
    });

    const prefix = viewport.name.toUpperCase();
    check(`${prefix}-SMOKE`, (await page.title()) === "Mawquta — Prayer Times" && state.singleMount && state.sectionsReady);
    check(`${prefix}-CLEAN`, consoleErrors.length === 0 && pageErrors.length === 0 && badResponses.length === 0, [...consoleErrors, ...pageErrors, ...badResponses].join(" | "));
    check(`${prefix}-RESPONSIVE`, state.noOverflow && state.responsive && state.mobileContent);
    check(`${prefix}-ACCESSIBILITY`, state.accessible);
    check(`${prefix}-REQUESTS`, calendarRequests === 1, `calendarRequests=${calendarRequests}`);

    if (viewport.width <= 575) {
      const requestsBeforeSelection = calendarRequests;
      const selectedBefore = await page.locator("[data-weekly-day-select]").inputValue();
      await page.locator("[data-weekly-day-select]").selectOption({ index: 1 });
      await page.waitForFunction((previous) => {
        const select = document.querySelector("[data-weekly-day-select]");
        return select?.value !== previous && document.querySelector(".weekly-table-mobile-card")?.textContent.includes("اليوم") === false;
      }, selectedBefore);
      check(`${prefix}-LOCAL-DAY`, calendarRequests === requestsBeforeSelection);

      await page.locator("[data-weekly-day-select]").selectOption({ index: 0 });
      await page.waitForFunction(() => document.querySelector(".weekly-table-mobile-pill")?.textContent === "اليوم");
      check(`${prefix}-TODAY-SEMANTICS`, calendarRequests === requestsBeforeSelection);
    }
  }

  await context.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`BROWSER_SUMMARY pass=${results.length - failed.length} fail=${failed.length} total=${results.length}`);
  if (failed.length) throw new Error(`browser coverage failed: ${failed.map(({ id }) => id).join(", ")}`);
}
