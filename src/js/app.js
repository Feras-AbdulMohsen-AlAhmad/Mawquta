import {
  getCurrentCoords,
  reverseGeocodeToCityCountry,
} from "./api/location.api.js";
import {
  getTodayPrayerOverviewByCoords,
  getTodayPrayerOverviewByCity,
  buildPrayerViewModelFromTimings,
} from "./services/prayer.service.js";
import { getRamadanCountdown } from "./services/ramadan.service.js";

import {
  getCurrentWeekByCity,
  getCurrentWeekByCoords,
} from "./services/week.service.js";
import { getQiblaByCoords } from "./services/qibla.service.js";

import { renderTodayPrayers } from "./ui/render-prayers.js";
import { renderNextPrayerCountdown } from "./ui/render-countdown.js";
import { renderWeekPreview } from "./ui/render-week.js";
import { renderRamadanCountdown } from "./ui/render-ramadan.js";
import { renderQibla } from "./ui/render-qibla.js";

// ===== Location persistence (Step 1) =====
const STORAGE_KEY = "ms_location";

// Default location (you can change later anytime)
const DEFAULT_LOCATION = {
  // ==== City Type ====
  type: "city",
  city: "Homs",
  country: "Syria",

  // ==== Coords Type (uncomment to use) ====
  // type: "coords",
  // latitude: 34.72682,
  // longitude: 36.72339,
};

// Get the saved location from localStorage, if any, and validate its shape.
// We expect either a "coords" object with latitude and longitude, or a "city" object with city and country.
// If the data is invalid or not present, return null.
function loadSavedLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // minimal shape check
    if (
      parsed?.type === "coords" &&
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number"
    ) {
      return parsed;
    }

    if (
      parsed?.type === "city" &&
      typeof parsed.city === "string" &&
      typeof parsed.country === "string"
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

// Save a location object to localStorage.
// The locationObj should have a "type" property that is either "coords" or "city", along with the corresponding properties for each type.
function saveLocation(locationObj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locationObj));
}

// ===== Bootstrap (Step 2) =====
function resolveInitialLocation() {
  const saved = loadSavedLocation();
  return saved ?? DEFAULT_LOCATION;
}

// Get Current User Location (coords or city)
let activeLocation = resolveInitialLocation();

// ===== Main Initialization (Step 3) =====
async function init(location, options = {}) {
  // Get references to key DOM elements
  const todayContainer = document.getElementById("todayTimings");
  const nextPrayerCard = document.getElementById("nextPrayerCard");
  const metaLocation = document.getElementById("metaLocation");
  const btnBackToToday = document.getElementById("btnBackToToday");
  const ramadanCard = document.getElementById("ramadanCard");
  const qiblaCard = document.getElementById("qiblaCard");
  const qiblaDegrees = document.getElementById("qiblaDegrees");

  const { bypassCacheWeekRefresh = false } = options;

  let viewModel;

  if (location.type === "coords") {
    viewModel = await getTodayPrayerOverviewByCoords(
      location.latitude,
      location.longitude,
    );

    if (location.city && location.country) {
      metaLocation.textContent = `${location.city}، ${location.country}`;
    } else {
      const { city, country } = await reverseGeocodeToCityCountry(
        // location.latitude,
        // location.longitude,

        // Homs latitude and longitude
        34.72682,
        36.72339,
        "ar",
      );

      metaLocation.textContent = `${city}، ${country}`;

      // metaLocation.textContent = `موقعك الحالي`;
    }
  } else {
    viewModel = await getTodayPrayerOverviewByCity(
      location.city,
      location.country,
    );
    metaLocation.textContent = `${location.city}، ${location.country}`;
  }

  renderTodayPrayers(
    todayContainer,
    viewModel.prayers,
    viewModel.nextPrayer.key,
  );
  renderNextPrayerCountdown(nextPrayerCard, viewModel.nextPrayer, () =>
    init(location),
  );

  btnBackToToday.classList.add("d-none");

  // Get and render qibla direction
  if (location.type === "coords") {
    const q = await getQiblaByCoords(location.latitude, location.longitude);

    qiblaDegrees.textContent = `${Math.round(q.direction)}°`;
    renderQibla(qiblaCard, q, () => {
      document.getElementById("btnLocate")?.click();
    });
  } else {
    qiblaDegrees.textContent = "—";
    renderQibla(qiblaCard, null, () => {
      document.getElementById("btnLocate")?.click();
    });
  }

  let week;
  // Get current week data

  // We bypass the cache when refreshing the week data after selecting a different day, to ensure we get any updates.
  // (e.g. daylight saving changes) without waiting for the cache to expire.
  if (location.type === "coords") {
    week = await getCurrentWeekByCoords(
      location.latitude,
      location.longitude,
      new Date(),
      bypassCacheWeekRefresh,
    );
  } else {
    week = await getCurrentWeekByCity(
      location.city,
      location.country,
      new Date(),
      bypassCacheWeekRefresh,
    );
  }

  // Render week preview
  const weekContainer = document.getElementById("weekPreview");

  renderWeekPreview(weekContainer, week, (selectedDay) => {
    const apiDateStr = selectedDay?.date?.gregorian?.date; // "DD-MM-YYYY"

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const todayStr = `${dd}-${mm}-${yyyy}`;

    const isTodaySelected = apiDateStr === todayStr;

    if (isTodaySelected) {
      btnBackToToday.classList.add("d-none");
    } else {
      btnBackToToday.classList.remove("d-none");
    }

    const todayContainer = document.getElementById("todayTimings");
    const nextPrayerCard = document.getElementById("nextPrayerCard");
    const metaDate = document.getElementById("metaDate");

    const viewModel2 = buildPrayerViewModelFromTimings(selectedDay.timings);

    // update date label
    metaDate.textContent = selectedDay?.date?.gregorian?.date || "—";

    renderTodayPrayers(
      todayContainer,
      viewModel2.prayers,
      viewModel2.nextPrayer.key,
    );
    renderNextPrayerCountdown(nextPrayerCard, viewModel2.nextPrayer, () =>
      init(location),
    );
  });
  // Update the "last updated at" time in the metadata section to show when the data was last refreshed
  const metaUpdatedAt = document.getElementById("metaUpdatedAt");
  const now = new Date();
  metaUpdatedAt.textContent = `آخر تحديث: ${now.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}`;

  // Set initial date label to the first day in the week (which should be today)
  metaDate.textContent = week?.[0]?.date?.gregorian?.date || "—";

  const ramadanviewModel = await getRamadanCountdown();
  renderRamadanCountdown(ramadanCard, ramadanviewModel);
}

async function bootstrap() {
  await init(activeLocation);
}

bootstrap();

// Back to today button click handler to re-render today's timings when viewing a different day in the week preview
document.getElementById("btnBackToToday").addEventListener("click", () => {
  init(activeLocation);
});

// Refresh week data on button click, bypassing the cache to get the latest data from the API, and re-render the week preview and today's timings
document.getElementById("btnRefresh").addEventListener("click", async () => {
  const btn = document.getElementById("btnRefresh");
  const oldText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = "جاري التحديث…";
    await init(activeLocation, { bypassCacheWeekRefresh: true });
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

// Get user's current location on button click, save it in localStorage, and re-render timings
document.getElementById("btnLocate").addEventListener("click", async () => {
  try {
    const { latitude, longitude } = await getCurrentCoords();

    const { city, country } = await reverseGeocodeToCityCountry(
      latitude,
      longitude,
      "ar",
    );

    const newLocation = {
      type: "coords",
      latitude,
      longitude,
      city,
      country,
    };

    saveLocation(newLocation);
    activeLocation = newLocation;

    await init(activeLocation);
  } catch (e) {
    console.error(e);
    alert("تعذر الحصول على موقعك. تأكد من السماح بالموقع في المتصفح.");
  }
});
