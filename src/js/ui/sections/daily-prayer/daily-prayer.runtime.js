// src/js/ui/sections/daily-prayer/daily-prayer.runtime.js
// Orchestrates live daily prayer data: subscribes to the location service,
// builds the unified Daily contract through daily-prayer.service.js and
// re-renders the daily section plus the Hero next-prayer card, countdown and
// date card. The date card values flow from the same contract's dateInfo block
// (built from the shared monthly calendar payload); the Hero never fetches.
//
// The runtime never requests geolocation itself and never issues Qibla,
// Ramadan or independent Hero requests. The daily service is injected so this
// module stays Node-testable (aladhan.api.js requires window.axios).

import {
  buildLocationKey,
  recomputeNextPrayer,
} from "../../../services/daily-prayer.service.js";
import {
  getDateKeyInTimeZone,
  computeRemainingSeconds,
  formatRemaining,
} from "../../../utils/time.util.js";
import {
  getCurrentPrayerKey,
  renderDailyPrayerCards,
} from "./components/prayer-cards.component.js";
import { updateHeroSectionLiveState } from "../hero/hero.section.js";
import { renderFeedbackState } from "../../shared/feedback/feedback.js";

function defaultFormatLocation(location) {
  if (!location) return "الموقع غير محدد";

  if (location.city === "Damascus" && location.country === "Syria") {
    return "دمشق، سوريا";
  }

  return `${location.city}، ${location.country}`;
}

const renderDailyLoadingState = () => renderFeedbackState({ type: "loading", className: "daily-prayer-loading", message: "جارٍ تحميل مواقيت اليوم…", ariaLabel: "جارٍ تحميل مواقيت الصلاة اليومية" });
const renderDailyEmptyState = () => renderFeedbackState({ type: "empty", className: "daily-prayer-empty", message: "لا تتوفر بيانات مواقيت لهذا اليوم حالياً." });
const renderDailyErrorState = () => renderFeedbackState({ type: "error", className: "daily-prayer-error", message: "تعذر تحميل مواقيت الصلاة اليومية.", retryAttribute: "daily-retry" });

export function createDailyPrayerRuntime(options = {}) {
  const {
    rootElement,
    heroRootElement,
    locationService,
    dailyService,
    formatLocation = defaultFormatLocation,
    now = () => new Date(),
    intervalMs = 1000,
  } = options;

  let sequence = 0;
  let loadKey = null;
  let attemptKey = null;
  let pendingKey = null;
  let unsubscribe = null;
  let countdownTimer = null;
  let retryBound = false;

  const state = {
    status: "idle",
    contract: null,
    location: null,
  };

  function getHeadElements() {
    return {
      cityElement: rootElement?.querySelector("[data-daily-city]"),
      statusElement: rootElement?.querySelector(
        ".daily-prayer-section__meta-value",
      ),
      dataElement: rootElement?.querySelector("[data-daily-data]"),
    };
  }

  function getStatusText() {
    switch (state.status) {
      case "success":
        return state.contract?.nextPrayer
          ? `متبقي حتى صلاة ${state.contract.nextPrayer.label}`
          : "محدث";
      case "empty":
        return "لا توجد بيانات";
      case "error":
        return state.contract ? "تعذر التحديث" : "تعذر التحميل";
      case "stale":
      case "loading":
      default:
        return state.contract ? "جارٍ التحديث…" : "جارٍ التحميل…";
    }
  }

  function renderCards() {
    const { dataElement } = getHeadElements();
    if (!dataElement) return;
    if (state.status === "success" && state.contract) {
      dataElement.innerHTML = renderDailyPrayerCards(
        state.contract.prayers,
        getCurrentPrayerKey(state.contract.prayers),
      );
    }
  }

  function applyState() {
    const { cityElement, statusElement, dataElement } = getHeadElements();
    if (!cityElement || !statusElement || !dataElement) return;

    cityElement.textContent = state.location
      ? formatLocation(state.location)
      : "دمشق، سوريا";
    statusElement.textContent = getStatusText();

    const hasData = Boolean(state.contract);

    if (state.status === "success" && state.contract) {
      renderCards();
      return;
    }

    if (hasData) {
      // stale / error / empty while valid same-location data is present:
      // keep the cards untouched and only surface the status in the head.
      return;
    }

    if (state.status === "empty") {
      dataElement.innerHTML = renderDailyEmptyState();
    } else if (state.status === "error") {
      dataElement.innerHTML = renderDailyErrorState();
    } else {
      dataElement.innerHTML = renderDailyLoadingState();
    }

    // No contract available: never leave static fixture values on the hero.
    renderHeroPlaceholder();
  }

  function renderHeroPlaceholder() {
    updateHeroSectionLiveState(heroRootElement, {
      nextPrayerKey: "",
      nextPrayerLabel: "—",
      nextPrayerTime: "--:--",
      hours: "--",
      minutes: "--",
      seconds: "--",
      dayLabel: "—",
      hijriDate: "—",
      gregorianDate: "—",
    });
  }

  function renderHero() {
    if (!state.contract) {
      renderHeroPlaceholder();
      return;
    }

    const current = now();

    if (state.contract.nextPrayer) {
      const target = new Date(state.contract.nextPrayer.occursAt);
      if (current.getTime() >= target.getTime()) {
        state.contract = recomputeNextPrayer(state.contract, current);
        renderCards();
      }
    }

    const remainingSeconds = state.contract.nextPrayer
      ? computeRemainingSeconds(state.contract.nextPrayer.occursAt, current)
      : 0;
    const parts = formatRemaining(remainingSeconds);

    const dateInfo = state.contract.dateInfo || null;

    updateHeroSectionLiveState(heroRootElement, {
      nextPrayerKey: state.contract.nextPrayer?.key ?? "",
      nextPrayerLabel: state.contract.nextPrayer?.label ?? "—",
      nextPrayerTime: state.contract.nextPrayer?.time ?? "--:--",
      hours: parts.hours,
      minutes: parts.minutes,
      seconds: parts.seconds,
      dayLabel: dateInfo?.weekdayLabel ?? "—",
      hijriDate: dateInfo?.hijriLabel ?? "—",
      gregorianDate: dateInfo?.gregorianLabel ?? "—",
    });
  }

  function buildLoadKey(location) {
    const locationKey = buildLocationKey(location);
    const todayKey = getDateKeyInTimeZone(location.timezone, now());
    return `${locationKey}:${todayKey}`;
  }

  async function load(location, { force = false } = {}) {
    const key = buildLoadKey(location);

    if (!force) {
      if (key === loadKey && state.contract) return;
      if (key === pendingKey) return;
      if (
        key === attemptKey &&
        (state.status === "error" || state.status === "empty")
      ) {
        return;
      }
    }

    const token = ++sequence;
    attemptKey = key;
    pendingKey = key;
    state.location = location;
    state.status = state.contract ? "stale" : "loading";
    applyState();

    try {
      const contract = await dailyService.getByLocation(location);

      if (token !== sequence) return;

      if (
        !contract ||
        !Array.isArray(contract.prayers) ||
        contract.prayers.length === 0
      ) {
        state.status = "empty";
        if (!state.contract) loadKey = null;
        applyState();
        return;
      }

      if (token !== sequence) return;

      state.status = "success";
      state.contract = contract;
      state.location = location;
      loadKey = key;
      applyState();
      renderHero();
    } catch (error) {
      if (token !== sequence) return;

      state.status = "error";
      applyState();
    } finally {
      if (token === sequence) pendingKey = null;
    }
  }

  function tick() {
    if (!state.contract || !state.location) {
      renderHeroPlaceholder();
      return;
    }

    const current = now();
    const todayKey = getDateKeyInTimeZone(state.location.timezone, current);

    // Midnight rollover in the location timezone: drop yesterday's contract
    // and reload automatically, without waiting for a manual refresh.
    if (todayKey !== state.contract.dateKey) {
      state.contract = null;
      loadKey = null;
      void load(state.location, { force: true });
      return;
    }

    renderHero();
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
    const nextLocationKey = buildLocationKey(location);
    const previousLocationKey = state.location
      ? buildLocationKey(state.location)
      : null;

    state.location = location;

    // Never keep previous-location data when the location key changes.
    if (previousLocationKey !== null && previousLocationKey !== nextLocationKey) {
      state.contract = null;
      loadKey = null;
    }

    void load(location);
  }

  function bindRetry() {
    if (retryBound || !rootElement) return;
    retryBound = true;

    rootElement.addEventListener("click", (event) => {
      if (!event.target?.closest?.("[data-daily-retry]")) return;
      if (state.location) void load(state.location, { force: true });
    });
  }

  function destroy() {
    sequence += 1;
    pendingKey = null;
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  if (!rootElement || !locationService || !dailyService) {
    return Object.freeze({ destroy: () => {} });
  }

  bindRetry();
  countdownTimer = setInterval(tick, intervalMs);
  unsubscribe = locationService.subscribe(onLocationState);

  return Object.freeze({ destroy });
}
