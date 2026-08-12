/* =========================================================
   Static UI Bootstrap (UI-only phase)
========================================================= */

import { renderAppShell } from "../ui/layout/app-shell.layout.js";
import { renderHeaderSection } from "../ui/sections/header/header.section.js";
import { renderFooterSection } from "../ui/sections/footer/footer.section.js";
import { renderHeroSection } from "../ui/sections/hero/hero.section.js";
import { renderDailyPrayerSection } from "../ui/sections/daily-prayer/daily-prayer.section.js";
import { renderWeeklyPrayerSection } from "../ui/sections/weekly-prayer/weekly-prayer.section.js";
import { createWeeklyPrayerRuntime } from "../ui/sections/weekly-prayer/weekly-prayer.runtime.js";
import { createDailyPrayerRuntime } from "../ui/sections/daily-prayer/daily-prayer.runtime.js";
import { renderQiblaSection } from "../ui/sections/qibla/qibla.section.js";
import { renderRamadanSection } from "../ui/sections/ramadan/ramadan.section.js";
import { bindHeaderNavInteractions } from "../ui/sections/header/interactions/nav.interactions.js";
import { bindRamadanTabsInteractions } from "../ui/sections/ramadan/interactions/ramadan-tabs.interactions.js";
import { createLocationService } from "../services/location.service.js";
import { createDailyPrayerService } from "../services/daily-prayer.service.js";
import { createQiblaService } from "../services/qibla.service.js";
import { createQiblaRuntime } from "../ui/sections/qibla/qibla.runtime.js";
import { createRamadanService } from "../services/ramadan.service.js";
import { createRamadanRuntime } from "../ui/sections/ramadan/ramadan.runtime.js";
import { searchCitySuggestions } from "../services/location-search.service.js";
import {
  getCurrentWeekByCity,
  getCurrentWeekByCoords,
  getTodayByCity,
  getTodayByCoords,
  getMonthCalendarByCity,
  getMonthCalendarByCoords,
} from "../services/week.service.js";
import {
  getTimingsByCityAndCountry,
  getTimingsByCoords,
} from "../api/aladhan.api.js";
import { bindLocationPickerInteractions } from "../ui/sections/qibla/interactions/location-picker.interactions.js";
import { createToastController } from "../ui/shared/feedback/feedback.js";

const locationService = createLocationService();

const dailyPrayerService = createDailyPrayerService({
  getTodayByCity,
  getTodayByCoords,
  getTimingsByCityAndCountry,
  getTimingsByCoords,
});

// Resolves coordinates for coordinate-less cities through the existing
// /api/geocode path (GeoNames) used by the picker. Reused by the Qibla
// service, which dedupes lookups per city within a session.
async function geocodeCityCoordinates(city, country) {
  const results = await searchCitySuggestions(city, { lang: "ar" });
  const best =
    results.find((r) => r.city === city && r.country === country) ??
    results.find((r) => r.city === city) ??
    results[0];

  if (
    !best ||
    !Number.isFinite(Number(best.lat)) ||
    !Number.isFinite(Number(best.lon))
  ) {
    throw new Error("تعذر تحديد إحداثيات المدينة");
  }

  return {
    latitude: Number(best.lat),
    longitude: Number(best.lon),
  };
}

const qiblaService = createQiblaService({
  geocodeCity: geocodeCityCoordinates,
});

const ramadanService = createRamadanService({
  getTodayByCity,
  getTodayByCoords,
  getMonthCalendarByCity,
  getMonthCalendarByCoords,
});

// Retained for tests and cleanup (destroy()).
let dailyPrayerRuntime = null;
let qiblaRuntime = null;
let ramadanRuntime = null;
let weeklyPrayerRuntime = null;
let unbindLocationPicker = null;

// Unified teardown ownership: every runtime destroy and interaction unbind is
// registered exactly once and released together by teardownApp(). Internal and
// testable only; no unload hook is imposed on the app.
const cleanups = [];

function registerCleanup(cleanup) {
  if (typeof cleanup === "function") {
    cleanups.push(cleanup);
  }
}

function teardownApp() {
  for (const cleanup of cleanups.splice(0)) {
    try {
      cleanup();
    } catch {
      // Teardown must never throw.
    }
  }
}

function bootstrapApp() {
  locationService.initialize();

  const appRoot = document.getElementById("app");
  if (!appRoot) {
    console.warn(
      '[Runtime] Missing #app mount root. Ensure src/index.html includes <div id="app"></div>.',
    );
    return;
  }

  renderAppShell(appRoot);

  const appHeaderRoot = document.getElementById("site-header");
  const appHeroRoot = document.getElementById("hero-section");
  const appDailyPrayerRoot = document.getElementById("prayer-section");
  const appWeeklyPrayerRoot = document.getElementById("weekly-prayer-section");
  const appQiblaRoot = document.getElementById("qibla-section");
  const appRamadanRoot = document.getElementById("ramadan-section");
  const appFooterRoot = document.getElementById("site-footer");

  renderHeaderSection(appHeaderRoot);
  bindHeaderNavInteractions(appHeaderRoot);

  renderHeroSection(appHeroRoot);
  renderDailyPrayerSection(appDailyPrayerRoot);
  renderWeeklyPrayerSection(appWeeklyPrayerRoot);
  renderQiblaSection(appQiblaRoot);
  renderRamadanSection(appRamadanRoot);
  renderFooterSection(appFooterRoot);
  const toastController = createToastController(document);

  weeklyPrayerRuntime = createWeeklyPrayerRuntime({
    rootElement: appWeeklyPrayerRoot,
    locationService,
    getCurrentWeekByCity,
    getCurrentWeekByCoords,
  });
  registerCleanup(() => weeklyPrayerRuntime.destroy());

  dailyPrayerRuntime = createDailyPrayerRuntime({
    rootElement: appDailyPrayerRoot,
    heroRootElement: appHeroRoot,
    locationService,
    dailyService: dailyPrayerService,
  });
  registerCleanup(() => dailyPrayerRuntime.destroy());

  qiblaRuntime = createQiblaRuntime({
    rootElement: appQiblaRoot,
    locationService,
    qiblaService,
  });
  registerCleanup(() => qiblaRuntime.destroy());

  ramadanRuntime = createRamadanRuntime({
    rootElement: appRamadanRoot,
    locationService,
    ramadanService,
  });
  registerCleanup(() => ramadanRuntime.destroy());

  bindRamadanTabsInteractions(document);
  unbindLocationPicker = bindLocationPickerInteractions(
    document,
    locationService,
    toastController,
  );
  registerCleanup(() => unbindLocationPicker?.());
}

bootstrapApp();
