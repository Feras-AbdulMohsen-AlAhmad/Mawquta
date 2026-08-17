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
      body: JSON.stringify({
        ok: true,
        results: [{
          label: "Damascus, Syria",
          city: "Damascus",
          country: "Syria",
          lat: 33.5138,
          lon: 36.2765,
          timezone: "Asia/Damascus",
        }],
      }),
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
      const weeklyTimeCount = document.querySelectorAll(".weekly-prayer-section .weekly-table-mobile-card time.weekly-table-mobile-item__time[dir='ltr']").length;
      const weeklyGridColumns = getComputedStyle(document.querySelector(".weekly-prayer-section .weekly-table-mobile-grid")).gridTemplateColumns.split(" ").filter(Boolean).length;
      const weeklyLastItem = document.querySelector(".weekly-prayer-section .weekly-table-mobile-item:last-child");
      const weeklyLastItemSpansGrid = innerWidth <= 335 || getComputedStyle(weeklyLastItem).gridColumn === "1 / -1";
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
        mobileContent: innerWidth <= 575 ? weeklyTimeCount === 5 && weeklyLastItemSpansGrid && (innerWidth <= 335 ? weeklyGridColumns === 1 : weeklyGridColumns === 2) : true,
        accessible: !liveAncestor && Boolean(document.querySelector("[data-hero-live-status]")) && document.querySelector("label[for='weekly-day-select']")?.textContent === "اختيار اليوم" && document.querySelector("[data-weekly-day-select]")?.getAttribute("aria-label") === "اختيار اليوم" && document.querySelector("[data-weekly-day-select]")?.getAttribute("aria-haspopup") === "listbox" && document.querySelector("[data-weekly-day-options]")?.getAttribute("role") === "listbox" && document.querySelectorAll("[data-weekly-day-option][aria-selected='true']").length === 1 && document.querySelectorAll(".daily-prayer-card[aria-current='true']").length === 1 && /^اتجاه القبلة بزاوية \d+°$/.test(document.querySelector("[data-qibla-compass]")?.getAttribute("aria-label") || ""),
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
      const trigger = page.locator("[data-weekly-day-select]");
      const selectedBefore = await trigger.getAttribute("data-selected-day-key");
      await trigger.click();
      check(`${prefix}-OPEN-CUSTOM`, await trigger.getAttribute("aria-expanded") === "true" && await page.locator("[data-weekly-day-options]").isVisible() && await page.locator("[data-weekly-day-option]").count() === 7);
      await page.locator("[data-weekly-day-option]").nth(1).evaluate((option) => option.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      await page.waitForFunction((previous) => {
        const select = document.querySelector("[data-weekly-day-select]");
        return select?.getAttribute("data-selected-day-key") !== previous && document.querySelector(".weekly-table-mobile-card")?.textContent.includes("اليوم") === false;
      }, selectedBefore);
      check(`${prefix}-LOCAL-DAY`, calendarRequests === requestsBeforeSelection);

      await trigger.click();
      await page.locator("[data-weekly-day-option]").first().evaluate((option) => option.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      await page.waitForFunction(() => document.querySelector(".weekly-table-mobile-pill")?.textContent === "اليوم");
      check(`${prefix}-TODAY-SEMANTICS`, calendarRequests === requestsBeforeSelection);

      await trigger.click();
      await page.keyboard.press("Escape");
      check(`${prefix}-ESCAPE-CLOSE`, await trigger.getAttribute("aria-expanded") === "false");

      await trigger.press("ArrowDown");
      check(`${prefix}-KEYBOARD-NAV`, await page.locator("[data-weekly-day-option]").first().evaluate((option) => option === document.activeElement));
      await page.keyboard.press("End");
      check(`${prefix}-END-NAV`, await page.locator("[data-weekly-day-option]").last().evaluate((option) => option === document.activeElement));
      await page.keyboard.press("Home");
      check(`${prefix}-HOME-NAV`, await page.locator("[data-weekly-day-option]").first().evaluate((option) => option === document.activeElement));
      await page.keyboard.press("Escape");

      await trigger.click();
      await page.evaluate(() => document.body.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      check(`${prefix}-OUTSIDE-CLOSE`, await trigger.getAttribute("aria-expanded") === "false");

      await trigger.click();
      await page.keyboard.press("Tab");
      check(`${prefix}-TAB-CLOSE`, await trigger.getAttribute("aria-expanded") === "false");

      const locationTrigger = page.locator('[data-bs-target="#qiblaCityModal"]:visible').first();
      await locationTrigger.click();
      await page.waitForFunction(() => document.querySelector("#qiblaCityModal")?.classList.contains("show"));
      await page.waitForTimeout(260);
      const initialModal = await page.evaluate(() => {
        const modal = document.querySelector("#qiblaCityModal");
        const dialog = modal?.querySelector("[data-location-dialog]");
        const close = modal?.querySelector(".qibla-city-modal__close");
        const input = modal?.querySelector("[data-location-query]");
        const cancel = modal?.querySelector("[data-location-cancel]");
        const confirm = modal?.querySelector("[data-location-confirm]");
        const rect = dialog?.getBoundingClientRect();
        const visible = (element) => element && getComputedStyle(element).display !== "none" && element.getBoundingClientRect().height > 0;
        return {
          inputFocused: document.activeElement === input,
          safeFocus: document.activeElement === dialog || document.activeElement === close,
          fullyVisible: Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight + 1),
          footerVisible: visible(cancel) && visible(confirm),
          pageLocked: document.body.classList.contains("modal-open") && getComputedStyle(document.body).overflow === "hidden",
          activeElement: document.activeElement?.className || document.activeElement?.tagName,
          dialogTabIndex: dialog?.getAttribute("tabindex"),
          dialogTransform: dialog ? getComputedStyle(dialog).transform : "",
          dialogRect: rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null,
        };
      });
      check(`${prefix}-LOCATION-OPEN`, !initialModal.inputFocused && initialModal.safeFocus && initialModal.fullyVisible && initialModal.footerVisible && initialModal.pageLocked, JSON.stringify(initialModal));

      const locationInput = page.locator("[data-location-query]");
      await locationInput.click();
      await page.waitForFunction(() => document.querySelector("#qiblaCityModal")?.classList.contains("qibla-city-modal--keyboard-open"));
      await locationInput.fill("Dam");
      await page.waitForSelector("[data-location-results] .qibla-city-modal__result");
      const searchModal = await page.evaluate(() => {
        const modal = document.querySelector("#qiblaCityModal");
        const input = modal?.querySelector("[data-location-query]");
        const results = modal?.querySelector("[data-location-results]");
        const cancel = modal?.querySelector("[data-location-cancel]");
        const confirm = modal?.querySelector("[data-location-confirm]");
        return {
          inputFocused: document.activeElement === input,
          resultsVisible: Boolean(results && getComputedStyle(results).display !== "none"),
          resultsScrollable: Boolean(results && getComputedStyle(results).overflowY === "auto"),
          footerVisible: [cancel, confirm].every((element) => element && getComputedStyle(element).display !== "none"),
        };
      });
      check(`${prefix}-LOCATION-SEARCH-MODE`, searchModal.inputFocused && searchModal.resultsVisible && searchModal.resultsScrollable && searchModal.footerVisible);

      await page.locator("[data-location-results] .qibla-city-modal__result").click();
      check(`${prefix}-LOCATION-CONFIRM-REACHABLE`, await page.locator("[data-location-confirm]").isVisible() && await page.locator("[data-location-confirm]").isEnabled() && await page.locator("[data-location-cancel]").isVisible());
      await page.locator("[data-location-confirm]").click();
      await page.waitForFunction(() => !document.querySelector("#qiblaCityModal")?.classList.contains("show"));
    }
  }

  await context.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`BROWSER_SUMMARY pass=${results.length - failed.length} fail=${failed.length} total=${results.length}`);
  if (failed.length) throw new Error(`browser coverage failed: ${failed.map(({ id }) => id).join(", ")}`);
}
