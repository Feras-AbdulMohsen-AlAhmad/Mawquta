import {
  getTodayPrayerOverviewByCoords,
  getTodayPrayerOverviewByCity,
} from "./services/prayer.service.js";
import { renderTodayPrayers } from "./ui/render-prayers.js";
import { renderNextPrayerCountdown } from "./ui/render-countdown.js";
import {
  getCurrentCoords,
  reverseGeocodeToCityCountry,
} from "./api/location.api.js";

// ===== Location persistence (Step 1) =====
const STORAGE_KEY = "ms_location";

// Default location (you can change later anytime)
const DEFAULT_LOCATION = {
  type: "city",
  city: "Homs",
  country: "Syria",
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
async function init(location) {
  const todayContainer = document.getElementById("todayTimings");
  const nextPrayerCard = document.getElementById("nextPrayerCard");
  const metaLocation = document.getElementById("metaLocation");

  let vm;

  if (location.type === "coords") {
    vm = await getTodayPrayerOverviewByCoords(
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
    vm = await getTodayPrayerOverviewByCity(location.city, location.country);
    metaLocation.textContent = `${location.city}، ${location.country}`;
  }

  renderTodayPrayers(todayContainer, vm.prayers, vm.nextPrayer.key);
  renderNextPrayerCountdown(nextPrayerCard, vm.nextPrayer, () =>
    init(location),
  );
}

async function bootstrap() {
  await init(activeLocation);
}

bootstrap();

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
