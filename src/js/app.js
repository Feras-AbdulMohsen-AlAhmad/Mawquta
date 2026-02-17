/* =========================================================
   Imports
========================================================= */
import { CONFIG } from "./config.js";

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
import { searchCitySuggestions } from "./services/location-search.service.js";

import { renderTodayPrayers } from "./ui/render-prayers.js";
import { renderNextPrayerCountdown } from "./ui/render-countdown.js";
import { renderWeekPreview } from "./ui/render-week.js";
import { renderRamadanCountdown } from "./ui/render-ramadan.js";
import { renderQibla } from "./ui/render-qibla.js";
import { renderCitySuggestions } from "./ui/render-city-suggestions.js";

/* =========================================================
   Storage Helpers
========================================================= */
function loadSavedLocation() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

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

function saveLocation(locationObj) {
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(locationObj));
}

function resolveInitialLocation() {
  const savedLocation = loadSavedLocation();
  return savedLocation ?? CONFIG.DEFAULT_LOCATION;
}

/* =========================================================
   Global State
========================================================= */
let activeLocation = resolveInitialLocation();
let pickedCitySuggestion = null;

/* =========================================================
   Small Utilities
========================================================= */
function normalizeText(value) {
  return String(value || "").trim();
}

function debounce(fn, delay = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function updateCityButtonLabel() {
  const btn = document.getElementById("btnPickCity");
  if (!btn) return;

  if (activeLocation?.type === "city") {
    btn.textContent = activeLocation.city || "مدينتي";
  } else {
    btn.textContent = "مدينتي";
  }
}

/* =========================================================
   DOM References (Common UI)
========================================================= */
const btnBackToToday = document.getElementById("btnBackToToday");

/* =========================================================
   City Modal DOM Binding
========================================================= */
let inputCity;
let inputCountry;
let cityFormError;
let btnSaveCity;
let cityModalEl;

let citySuggestionsEl;
let citySuggestHint;

function bindCityModalDom() {
  inputCity = document.getElementById("inputCity");
  inputCountry = document.getElementById("inputCountry");
  cityFormError = document.getElementById("cityFormError");
  btnSaveCity = document.getElementById("btnSaveCity");
  cityModalEl = document.getElementById("cityModal");

  citySuggestionsEl = document.getElementById("citySuggestions");
  citySuggestHint = document.getElementById("citySuggestHint");
}

/* =========================================================
   City Suggestions (Autocomplete)
========================================================= */
const runCitySearch = debounce(async () => {
  if (!inputCity || !citySuggestionsEl || !citySuggestHint || !btnSaveCity)
    return;

  const q = String(inputCity.value || "").trim();

  pickedCitySuggestion = null;
  btnSaveCity.disabled = true;
  btnSaveCity.title = "اختر مدينة من الاقتراحات أولاً";

  if (q.length < 3) {
    renderCitySuggestions(citySuggestionsEl, [], null);
    citySuggestHint.textContent = "ابدأ بكتابة 3 أحرف لعرض الاقتراحات.";
    return;
  }

  citySuggestHint.textContent = "جاري البحث...";

  try {
    const suggestions = await searchCitySuggestions(q, {
      maxRows: 8,
      lang: "en",
    });

    if (suggestions.length === 0) {
      renderCitySuggestions(citySuggestionsEl, [], null);
      citySuggestHint.textContent = "لا توجد نتائج. جرّب كتابة اسم مختلف.";
      return;
    }

    renderCitySuggestions(citySuggestionsEl, suggestions, (picked) => {
      pickedCitySuggestion = picked;

      btnSaveCity.disabled = false;
      btnSaveCity.title = "";

      inputCity.value = picked.city;
      inputCountry.value = picked.country;

      renderCitySuggestions(citySuggestionsEl, [], null);
      citySuggestHint.textContent = `تم اختيار: ${picked.label}`;
    });

    citySuggestHint.textContent = "اختر نتيجة من القائمة.";
  } catch (err) {
    renderCitySuggestions(citySuggestionsEl, [], null);
    citySuggestHint.textContent = "حدث خطأ أثناء البحث. حاول مرة أخرى.";
    console.error(err);
  }
}, 350);

/* =========================================================
   Main Init (Render Everything)
========================================================= */
async function init(location, options = {}) {
  const todayContainer = document.getElementById("todayTimings");
  const nextPrayerCard = document.getElementById("nextPrayerCard");
  const metaLocation = document.getElementById("metaLocation");

  const ramadanCard = document.getElementById("ramadanCard");

  const qiblaCard = document.getElementById("qiblaCard");
  const qiblaDegrees = document.getElementById("qiblaDegrees");

  const weekContainer = document.getElementById("weekPreview");
  const metaDate = document.getElementById("metaDate");
  const metaUpdatedAt = document.getElementById("metaUpdatedAt");

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
        location.latitude,
        location.longitude,
        "ar",
      );
      metaLocation.textContent = `${city}، ${country}`;
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

  renderWeekPreview(weekContainer, week, (selectedDay) => {
    const apiDateStr = selectedDay?.date?.gregorian?.date;

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

    const todayContainer2 = document.getElementById("todayTimings");
    const nextPrayerCard2 = document.getElementById("nextPrayerCard");
    const metaDate2 = document.getElementById("metaDate");

    const viewModel2 = buildPrayerViewModelFromTimings(selectedDay.timings);

    metaDate2.textContent = selectedDay?.date?.gregorian?.date || "—";

    renderTodayPrayers(
      todayContainer2,
      viewModel2.prayers,
      viewModel2.nextPrayer.key,
    );

    renderNextPrayerCountdown(nextPrayerCard2, viewModel2.nextPrayer, () =>
      init(location),
    );
  });

  const now2 = new Date();
  metaUpdatedAt.textContent = `آخر تحديث: ${now2.toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  metaDate.textContent = week?.[0]?.date?.gregorian?.date || "—";

  const ramadanviewModel = await getRamadanCountdown();
  renderRamadanCountdown(ramadanCard, ramadanviewModel);
}

/* =========================================================
   Bootstrap (initial run)
========================================================= */
async function bootstrap() {
  updateCityButtonLabel();

  bindCityModalDom();
  if (btnSaveCity) {
    btnSaveCity.disabled = true;
    btnSaveCity.title = "اختر مدينة من الاقتراحات أولاً";
  }

  if (inputCity) inputCity.addEventListener("input", runCitySearch);

  await init(activeLocation);
}

bootstrap();

/* =========================================================
   Header Buttons & General Actions
========================================================= */
document.getElementById("btnBackToToday").addEventListener("click", () => {
  init(activeLocation);
});

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

    updateCityButtonLabel();
    await init(activeLocation);
  } catch (e) {
    console.error(e);
    alert("تعذر الحصول على موقعك. تأكد من السماح بالموقع في المتصفح.");
  }
});

/* =========================================================
   City Modal (Open / Save)
========================================================= */
document.getElementById("btnPickCity").addEventListener("click", () => {
  bindCityModalDom();
  if (!cityFormError || !btnSaveCity) return;

  cityFormError.classList.add("d-none");
  cityFormError.textContent = "";

  pickedCitySuggestion = null;

  btnSaveCity.disabled = true;
  btnSaveCity.title = "اختر مدينة من الاقتراحات أولاً";

  if (citySuggestionsEl) renderCitySuggestions(citySuggestionsEl, [], null);
  if (citySuggestHint)
    citySuggestHint.textContent = "ابدأ بكتابة 3 أحرف لعرض الاقتراحات.";

  if (activeLocation?.type === "city") {
    inputCity.value = activeLocation.city || "";
    inputCountry.value = activeLocation.country || "";
  } else {
    inputCity.value = "Damascus";
    inputCountry.value = "Syria";
  }

  const modal = window.bootstrap.Modal.getOrCreateInstance(cityModalEl);
  modal.show();
});

btnSaveCity.addEventListener("click", async () => {
  bindCityModalDom();
  if (!cityFormError || !btnSaveCity) return;

  cityFormError.classList.add("d-none");
  cityFormError.textContent = "";

  const city = normalizeText(inputCity.value);
  const country = normalizeText(inputCountry.value);

  if (!city || !country) {
    cityFormError.textContent = "الرجاء إدخال المدينة والدولة.";
    cityFormError.classList.remove("d-none");
    return;
  }

  if (!pickedCitySuggestion) {
    cityFormError.textContent = "الرجاء اختيار مدينة من الاقتراحات.";
    cityFormError.classList.remove("d-none");
    return;
  }

  activeLocation = {
    type: "city",
    city: pickedCitySuggestion.city,
    country: pickedCitySuggestion.country,
    latitude: pickedCitySuggestion.lat,
    longitude: pickedCitySuggestion.lon,
  };

  saveLocation(activeLocation);

  updateCityButtonLabel();

  const modal = window.bootstrap.Modal.getOrCreateInstance(cityModalEl);
  modal.hide();

  await init(activeLocation, { forceWeekRefresh: true });
});
