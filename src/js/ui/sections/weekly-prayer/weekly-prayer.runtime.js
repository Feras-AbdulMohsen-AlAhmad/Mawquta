// src/js/ui/sections/weekly-prayer/weekly-prayer.runtime.js
// Orchestrates live weekly prayer data: subscribes to the location service,
// fetches the current 7-day week through week.service.js, formats it with
// weekly-formatter.service.js and re-renders the weekly section data area.
//
// The runtime never requests geolocation itself and never issues Qibla,
// Ramadan or daily-timings requests. week.service functions are injected so
// this module stays Node-testable (aladhan.api.js requires window.axios).
//
// Date rollover: a lightweight interval (default 30s) checks the location-local
// date key. When the local date changes (e.g. midnight in the location
// timezone), the weekly data is reloaded once for the current location. The
// interval never issues a request itself — it only compares date keys and lets
// the existing load() dedupe/sequence protection handle the actual fetch.

import {
  buildWeeklySectionData,
  getTodayDateInTimeZone,
  getTodayDateKey,
} from "../../../services/weekly-formatter.service.js";
import { renderWeeklyPrayerTableCard } from "./components/prayer-week-table.component.js";
import {
  findWeeklyRowByKey,
  getDefaultWeeklyDayKey,
} from "./components/weekly-prayer-selection.util.js";
import { CONFIG } from "../../../config/app.config.js";
import { renderFeedbackState } from "../../shared/feedback/feedback.js";

const DEFAULT_ROLLOVER_INTERVAL_MS = 30000;

// Resolves the authoritative timezone for a location. Normalized locations
// always carry `location.timezone`; when it is absent the project fallback
// (CONFIG.TZ_FALLBACK) is used instead of the device/system timezone so the
// rollover check stays deterministic per location.
function getEffectiveTimezone(location) {
  if (
    location &&
    typeof location.timezone === "string" &&
    location.timezone.trim()
  ) {
    return location.timezone;
  }
  return CONFIG.TZ_FALLBACK;
}

function defaultFormatLocation(location) {
  if (!location) return "الموقع غير محدد";

  if (location.city === "Damascus" && location.country === "Syria") {
    return "دمشق، سوريا";
  }

  return `${location.city}، ${location.country}`;
}

const renderWeeklyPrayerLoadingState = () => renderFeedbackState({ type: "loading", className: "weekly-prayer-loading", message: "جارٍ تحميل مواقيت الأسبوع…", ariaLabel: "جارٍ تحميل مواقيت الصلاة الأسبوعية" });
const renderWeeklyPrayerEmptyState = () => renderFeedbackState({ type: "empty", className: "weekly-prayer-empty", message: "لا تتوفر بيانات مواقيت لهذا الأسبوع حالياً." });
const renderWeeklyPrayerErrorState = () => renderFeedbackState({ type: "error", className: "weekly-prayer-error", message: "تعذر تحميل مواقيت الصلاة الأسبوعية.", retryAttribute: "weekly-retry" });

export function createWeeklyPrayerRuntime(options = {}) {
  const {
    rootElement,
    locationService,
    getCurrentWeekByCity,
    getCurrentWeekByCoords,
    formatLocation = defaultFormatLocation,
    now = () => new Date(),
    rolloverIntervalMs = DEFAULT_ROLLOVER_INTERVAL_MS,
    setIntervalFn = globalThis.setInterval,
    clearIntervalFn = globalThis.clearInterval,
  } = options;

  let sequence = 0;
  let loadKey = null;
  let attemptKey = null;
  let pendingKey = null;
  let unsubscribe = null;
  let retryBound = false;
  let rolloverTimer = null;
  let lastDateKey = null;

  const state = {
    status: "idle",
    sectionData: null,
    location: null,
    selectedDayKey: null,
  };

  function getHeadElements() {
    return {
      cityElement: rootElement?.querySelector("[data-weekly-city]"),
      metaElement: rootElement?.querySelector(".weekly-prayer-section__meta"),
      dataElement: rootElement?.querySelector("[data-weekly-data]"),
    };
  }

  function getMetaText() {
    switch (state.status) {
      case "success":
        return "محدث اليوم";
      case "empty":
        return "لا توجد بيانات";
      case "error":
        return state.sectionData ? "تعذر التحديث" : "تعذر التحميل";
      case "loading":
      default:
        return state.sectionData ? "جارٍ التحديث…" : "جارٍ التحميل…";
    }
  }

  function applyState() {
    const { cityElement, metaElement, dataElement } = getHeadElements();
    if (!cityElement || !metaElement || !dataElement) return;

    cityElement.textContent = state.location
      ? formatLocation(state.location)
      : "دمشق، سوريا";
    metaElement.textContent = getMetaText();

    const hasData = Boolean(state.sectionData);

    if (state.status === "success" && state.sectionData) {
      dataElement.innerHTML = renderWeeklyPrayerTableCard({
        rangeText: state.sectionData.rangeText,
        rows: state.sectionData.rows,
        selectedDayKey: state.selectedDayKey,
        selectorDisabled: state.status !== "success",
      });
      return;
    }

    if (hasData) {
      // Loading/error/empty while last-good data is present: keep the
      // existing table untouched and only surface the status in the head.
      return;
    }

    if (state.status === "empty") {
      dataElement.innerHTML = renderWeeklyPrayerEmptyState();
      return;
    }

    if (state.status === "error") {
      dataElement.innerHTML = renderWeeklyPrayerErrorState();
      return;
    }

    dataElement.innerHTML = renderWeeklyPrayerLoadingState();
  }

  function buildLoadKey(location) {
    const todayKey = getTodayDateKey(getEffectiveTimezone(location), now());
    if (location.type === "coords") {
      return `coords:${location.latitude},${location.longitude}:${todayKey}`;
    }
    return `city:${location.city}|${location.country}:${todayKey}`;
  }

  async function load(location, { force = false } = {}) {
    const key = buildLoadKey(location);

    if (!force) {
      if (key === loadKey && state.sectionData) return;
      if (key === pendingKey) return;
      if (
        key === attemptKey &&
        (state.status === "error" || state.status === "empty")
      ) {
        return;
      }
    }

    const token = ++sequence;
    if (key !== loadKey) state.selectedDayKey = null;
    attemptKey = key;
    pendingKey = key;
    state.location = location;
    state.status = "loading";
    applyState();

    try {
      const timeZone = getEffectiveTimezone(location);
      const weekAnchor = getTodayDateInTimeZone(timeZone, now());

      const calendarDays =
        location.type === "coords"
          ? await getCurrentWeekByCoords(
              location.latitude,
              location.longitude,
              weekAnchor,
              false,
            )
          : await getCurrentWeekByCity(
              location.city,
              location.country,
              weekAnchor,
              false,
            );

      if (token !== sequence) return;

      if (!Array.isArray(calendarDays) || calendarDays.length === 0) {
        state.status = "empty";
        if (!state.sectionData) loadKey = null;
        applyState();
        return;
      }

      const sectionData = buildWeeklySectionData({
        calendarDays,
        timeZone,
        now: now(),
      });

      if (token !== sequence) return;

      state.status = "success";
      state.sectionData = sectionData;
      state.location = location;
      loadKey = key;
      state.selectedDayKey = getDefaultWeeklyDayKey(sectionData.rows);
      applyState();
    } catch (error) {
      if (token !== sequence) return;

      state.status = "error";
      applyState();
    } finally {
      if (token === sequence) pendingKey = null;
    }
  }

  function onLocationState(locationState) {
    if (locationState?.phase !== "ready" || !locationState?.location) {
      if (!state.location) {
        state.status = "idle";
        applyState();
      }
      return;
    }

    const location = locationState.location;

    // R1: previous-location cleanup. When the location key actually changes
    // (A -> B), drop the previous section's data and load key immediately so
    // the stale A table is never shown under B's loading/error state and a
    // delayed A result cannot be adopted. Same-location refreshes keep the
    // last-good data untouched.
    const previousKey = state.sectionData ? loadKey : null;
    const nextKey = buildLoadKey(location);
    if (previousKey && previousKey !== nextKey) {
      state.sectionData = null;
      loadKey = null;
    }

    // Recompute the rollover date key immediately for the new location so the
    // rollover check never triggers a second load for the same date.
    lastDateKey = getTodayDateKey(getEffectiveTimezone(location), now());

    state.location = location;
    void load(location);
  }

  function checkRollover() {
    if (!state.location) return;

    const currentDateKey = getTodayDateKey(
      getEffectiveTimezone(state.location),
      now(),
    );
    if (currentDateKey === lastDateKey) return;

    // Local date changed: update the tracked key and reload for the current
    // location. load() dedupes via pendingKey/loadKey so no duplicate
    // in-flight request is created.
    lastDateKey = currentDateKey;
    void load(state.location);
  }

  function startRolloverCheck() {
    if (rolloverTimer !== null || !setIntervalFn) return;
    rolloverTimer = setIntervalFn(checkRollover, rolloverIntervalMs);
  }

  function bindRetry() {
    if (retryBound || !rootElement) return;
    retryBound = true;

    rootElement.addEventListener("click", (event) => {
      if (!event.target?.closest?.("[data-weekly-retry]")) return;
      if (state.location) void load(state.location, { force: true });
    });

    rootElement.addEventListener("change", (event) => {
      const select = event.target?.closest?.("[data-weekly-day-select]");
      if (!select || !state.sectionData) return;

      const selectedRow = findWeeklyRowByKey(
        state.sectionData.rows,
        select.value,
      );
      if (!selectedRow) {
        state.selectedDayKey = getDefaultWeeklyDayKey(state.sectionData.rows);
      } else {
        state.selectedDayKey = selectedRow.dateKey;
      }
      applyState();
    });
  }

  function destroy() {
    sequence += 1;
    pendingKey = null;
    if (rolloverTimer !== null) {
      if (clearIntervalFn) clearIntervalFn(rolloverTimer);
      rolloverTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  if (!rootElement || !locationService) {
    return Object.freeze({ destroy: () => {} });
  }

  bindRetry();
  unsubscribe = locationService.subscribe(onLocationState);
  startRolloverCheck();

  return Object.freeze({ destroy });
}
