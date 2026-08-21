import { CANONICAL_TIMINGS, makeMonthCalendar } from "../fixtures/calendar.mjs";

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

export async function runRamadanReadinessCoverage(browser, baseUrl) {
  const context = await browser.newContext({ viewport: VIEWPORTS[0] });
  await context.addInitScript(() => {
    const fixedNow = Date.parse("2026-03-15T12:00:00+03:00");
    const NativeDate = Date;
    globalThis.Date = class extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }
      static now() {
        return fixedNow;
      }
    };
  });
  await context.route("https://api.aladhan.com/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const payload = makeMonthCalendar({
      year: Number(url.searchParams.get("year")),
      month: Number(url.searchParams.get("month")),
      hijriDayOffset: 0,
      timesFor: () => CANONICAL_TIMINGS,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: payload }),
    });
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll(".ramadan-month-table-section tbody tr").length === 7,
  );
  const activeMarkup = await page.locator("[data-ramadan-month-table-grid]").innerHTML();

  const failures = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const label = `${viewport.width}x${viewport.height}`;
    const active = await page.evaluate(() => {
      const visible = (element) =>
        Boolean(element && getComputedStyle(element).display !== "none");
      const insideViewport = (element) => {
        if (!visible(element)) return true;
        const rect = element.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= innerWidth + 1;
      };
      const cards = [...document.querySelectorAll(
        ".ramadan-month-table-section .weekly-table-mobile-card",
      )];
      const actions = [...document.querySelectorAll("[data-ramadan-table-action]")];
      const bounded = [
        ...document.querySelectorAll(
          ".ramadan-topbar__chip, .ramadan-first-time, .ramadan-first__countdown, .ramadan-table-head, .ramadan-month-table__more",
        ),
      ];
      return {
        noOverflow:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
        bounded: bounded.every(insideViewport),
        compactRows:
          document.querySelectorAll(".ramadan-month-table-section tbody tr").length === 7 &&
          cards.length === 7,
        currentDay:
          Boolean(document.querySelector(".table-row--today")) &&
          Boolean(document.querySelector('.ramadan-mobile-card--today[aria-current="date"]')),
        actionsDisabled:
          actions.length === 2 && actions.every((button) => button.disabled),
        cardHeight:
          cards.every((card) => card.getBoundingClientRect().height < 420),
        responsiveMode:
          innerWidth <= 575
            ? !visible(document.querySelector(".ramadan-month-table-section .schedule-table-wrap")) &&
              visible(document.querySelector(".ramadan-month-table-section .weekly-table-mobile-list"))
            : visible(document.querySelector(".ramadan-month-table-section .schedule-table-wrap")) &&
              !visible(document.querySelector(".ramadan-month-table-section .weekly-table-mobile-list")),
      };
    });

    if (Object.values(active).some((value) => !value)) {
      failures.push(`${label}:active:${JSON.stringify(active)}`);
    }

    for (const stateName of ["loading", "error", "upcoming", "missing"]) {
      await page.evaluate(async (name) => {
        const module = await import(
          "/js/ui/sections/ramadan/components/ramadan-month-table-grid.component.js"
        );
        const renderers = {
          loading: module.renderRamadanTimetableLoading,
          error: module.renderRamadanTimetableError,
          upcoming: () => module.renderRamadanTimetableNoData({
            nextRamadanGregorianYear: 2027,
          }),
          missing: module.renderRamadanTimetableMissingData,
        };
        document.querySelector("[data-ramadan-month-table-grid]").innerHTML =
          renderers[name]();
      }, stateName);
      const state = await page.evaluate(() => {
        const panel = document.querySelector(
          "[data-ramadan-month-table-grid] > *",
        );
        const rect = panel.getBoundingClientRect();
        return {
          noOverflow:
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
          contained: rect.left >= -1 && rect.right <= innerWidth + 1,
          balancedHeight: rect.height > 0 && rect.height < 500,
        };
      });
      if (Object.values(state).some((value) => !value)) {
        failures.push(`${label}:${stateName}:${JSON.stringify(state)}`);
      }
    }

    await page.locator("[data-ramadan-month-table-grid]").evaluate(
      (element, html) => {
        element.innerHTML = html;
      },
      activeMarkup,
    );
    console.log(`PASS RAMADAN-RESPONSIVE-${label}`);
  }

  await context.close();
  if (failures.length) {
    throw new Error(`Ramadan responsive failures: ${failures.join(" | ")}`);
  }
}
