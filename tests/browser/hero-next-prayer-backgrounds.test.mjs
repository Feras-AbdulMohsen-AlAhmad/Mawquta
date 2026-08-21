import { promises as fs } from "node:fs";
import path from "node:path";

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

const PRAYERS = [
  { key: "fajr", label: "الفجر", asset: "fajr-background.png" },
  { key: "dhuhr", label: "الظهر", asset: "dhuhr-background.png" },
  { key: "asr", label: "العصر", asset: "asr-background.png" },
  { key: "maghrib", label: "المغرب", asset: "maghrib-background.png" },
  { key: "isha", label: "العشاء", asset: "isha-background.png" },
];

export async function runHeroNextPrayerBackgroundCoverage(browser, baseUrl) {
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

  const screenshotDirectory = process.env.HERO_SCREENSHOT_DIR;
  if (screenshotDirectory) {
    await fs.mkdir(screenshotDirectory, { recursive: true });
  }

  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-hero-next-prayer-card]");

  const failures = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const viewportLabel = `${viewport.width}x${viewport.height}`;
    const failureCountBeforeViewport = failures.length;
    let expectedCardSize = null;

    for (const prayer of PRAYERS) {
      await page.evaluate(async ({ key, label }) => {
        const { updateHeroSectionLiveState } = await import(
          "/js/ui/sections/hero/hero.section.js"
        );
        updateHeroSectionLiveState(document.querySelector("#hero-section"), {
          nextPrayerKey: key,
          nextPrayerLabel: label,
          nextPrayerTime: "15:45",
          hours: "01",
          minutes: "02",
          seconds: "03",
        });
      }, prayer);

      const state = await page.evaluate(({ key, asset }) => {
        const card = document.querySelector("[data-hero-next-prayer-card]");
        const countdown = card.querySelector(".hero-countdown");
        const bounded = [
          card.querySelector(".hero-prayer-card__header"),
          card.querySelector("[data-hero-next-prayer-time]"),
          card.querySelector("[data-hero-next-prayer-label]"),
          countdown,
          card.querySelector("[data-hero-countdown]"),
        ];
        const cardRect = card.getBoundingClientRect();
        const insideCard = (element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= cardRect.left - 1 &&
            rect.right <= cardRect.right + 1 &&
            rect.top >= cardRect.top - 1 &&
            rect.bottom <= cardRect.bottom + 1
          );
        };
        const cardStyle = getComputedStyle(card);
        const countdownStyle = getComputedStyle(countdown);
        const countdownValueStyle = getComputedStyle(
          card.querySelector(".hero-countdown__value"),
        );
        const countdownRect = countdown.getBoundingClientRect();
        const countdownTransform = new DOMMatrix(countdownStyle.transform);
        const imageValue = card.style.getPropertyValue(
          "--hero-next-prayer-background-image",
        );

        return {
          keyMatches: card.dataset.nextPrayer === key,
          assetMatches: imageValue.includes(`/next-prayer/${asset}`),
          imageFit:
            cardStyle.backgroundSize === "cover" &&
            cardStyle.backgroundRepeat === "no-repeat" &&
            cardStyle.backgroundPosition === "50% 100%",
          noPageOverflow:
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
          contentContained: bounded.every(insideCard),
          countdownCentered:
            Math.abs(
              (countdownRect.left - cardRect.left) -
                (cardRect.right - countdownRect.right),
            ) <= 1,
          countdownLifted: Math.abs(countdownTransform.m42 + 24) <= 0.1,
          countdownReadable:
            Number.parseFloat(countdownStyle.opacity) === 1 &&
            countdownStyle.visibility === "visible" &&
            countdownStyle.display !== "none" &&
            countdown.getBoundingClientRect().width >= 240 &&
            Number.parseFloat(countdownValueStyle.fontSize) >= 24,
          size: { width: cardRect.width, height: cardRect.height },
        };
      }, prayer);

      expectedCardSize ??= state.size;
      const stable =
        Math.abs(state.size.width - expectedCardSize.width) <= 1 &&
        Math.abs(state.size.height - expectedCardSize.height) <= 1;
      const checks = { ...state, stable };
      delete checks.size;
      if (Object.values(checks).some((value) => !value)) {
        failures.push(
          `${viewportLabel}:${prayer.key}:${JSON.stringify(checks)}`,
        );
      }

      if (screenshotDirectory) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator("[data-hero-next-prayer-card]").screenshot({
          path: path.join(
            screenshotDirectory,
            `${viewportLabel}-${prayer.key}.png`,
          ),
        });
      }
    }

    if (failures.length === failureCountBeforeViewport) {
      console.log(`PASS HERO-BACKGROUNDS-${viewportLabel}`);
    }
  }

  await context.close();
  if (failures.length) {
    throw new Error(`Hero background failures: ${failures.join(" | ")}`);
  }
}
