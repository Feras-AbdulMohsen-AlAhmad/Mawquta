// src/js/ui/sections/ramadan/ramadan.runtime.js
// Orchestrates live Ramadan data: subscribes to the location service, builds
// the unified Ramadan contract through ramadan.service.js and re-renders the
// topbar, the imsak/iftar card, the countdown and the month table.
//
// Mirrors daily-prayer.runtime.js: sequence tokens, load/pending/attempt keys,
// a 1-second countdown tick, midnight rollover in the location timezone, retry
// and destroy(). The runtime never requests geolocation and never issues
// Qibla, timings, conversion or independent calendar requests.

import {
  buildLocationKey,
  recomputeRamadanNextEvent,
} from "../../../services/ramadan.service.js";
import {
  getDateKeyInTimeZone,
  getTimePartsInTimeZone,
  buildOccursAt,
  computeRemainingSeconds,
  formatRemaining,
} from "../../../utils/time.util.js";
import { renderRamadanMonthTableGrid } from "./components/ramadan-month-table-grid.component.js";
import {
  renderRamadanTimetableLoading,
  renderRamadanTimetableNoLocation,
  renderRamadanTimetableNoData,
  renderRamadanTimetableError,
} from "./components/ramadan-month-table-grid.component.js";
import {
  MONTH_TABLE_ICON_PATHS,
  RAMADAN_MONTH_TABLE_COLUMNS,
} from "./components/ramadan-month-table.constants.js";
import { renderFeedbackState } from "../../shared/feedback/feedback.js";

const AR_WEEKDAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function defaultFormatLocation(location) {
  if (!location) return "الموقع غير محدد";

  if (location.city === "Damascus" && location.country === "Syria") {
    return "دمشق، سوريا";
  }

  return `${location.city}، ${location.country}`;
}

function formatUpdatedMeta(dateKey, timeZone, nowDate) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const parts = getTimePartsInTimeZone(timeZone, nowDate);
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${AR_WEEKDAYS[dow]} / ${hh}:${mm} / ${day} ${AR_MONTHS[month - 1]} ${year}`;
}

function getCountdownTitle(nextEvent) {
  if (!nextEvent) return "—";
  return nextEvent.key === "maghrib"
    ? "الوقت المتبقي للإفطار"
    : "الوقت المتبقي للإمساك";
}

function getProgressPercent(contract, nowDate) {
  if (!contract?.imsak || !contract?.maghrib || !contract?.dateKey || !contract?.timezone) return 0;
  const start = buildOccursAt({ dateKey: contract.dateKey, time: contract.imsak, timeZone: contract.timezone }).getTime();
  const end = buildOccursAt({ dateKey: contract.dateKey, time: contract.maghrib, timeZone: contract.timezone }).getTime();
  if (end <= start) return 0;
  return Math.round(Math.max(0, Math.min(1, (nowDate.getTime() - start) / (end - start))) * 100);
}

const renderRamadanLoadingState = () => renderFeedbackState({ type: "loading", className: "ramadan-prayer-loading", message: "جارٍ تحميل بيانات رمضان…", ariaLabel: "جارٍ تحميل بيانات رمضان" });
const renderRamadanRevalidatingState = () => renderFeedbackState({ type: "loading", className: "ramadan-prayer-stale", message: "جارٍ التحديث…" });
const renderRamadanEmptyDataState = () => renderFeedbackState({ type: "empty", className: "ramadan-prayer-empty", message: "لا تتوفر بيانات رمضان حالياً." });

const renderRamadanOffSeasonState = () => renderFeedbackState({ type: "empty", className: "ramadan-prayer-empty", message: "لا يوجد رمضان ضمن الشهر الحالي." });
const renderRamadanErrorState = () => renderFeedbackState({ type: "error", className: "ramadan-prayer-error", message: "تعذر تحميل بيانات رمضان.", retryAttribute: "ramadan-retry" });

export function createRamadanRuntime(options = {}) {
  const {
    rootElement,
    locationService,
    ramadanService,
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

  function getElements() {
    return {
      city: rootElement?.querySelector("[data-ramadan-city]"),
      month: rootElement?.querySelector("[data-ramadan-month]"),
      updated: rootElement?.querySelector("[data-ramadan-updated]"),
      dayLabel: rootElement?.querySelector("[data-ramadan-day-label]"),
      day: rootElement?.querySelector("[data-ramadan-day]"),
      data: rootElement?.querySelector("[data-ramadan-data]"),
      imsak: rootElement?.querySelector("[data-ramadan-imsak]"),
      iftar: rootElement?.querySelector("[data-ramadan-iftar]"),
      title: rootElement?.querySelector("[data-ramadan-countdown-title]"),
      hours: rootElement?.querySelector("[data-ramadan-countdown-hours]"),
      minutes: rootElement?.querySelector("[data-ramadan-countdown-minutes]"),
      seconds: rootElement?.querySelector("[data-ramadan-countdown-seconds]"),
      progressLabel: rootElement?.querySelector("[data-ramadan-progress-label]"),
      progressImsak: rootElement?.querySelector("[data-ramadan-progress-imsak]"),
      progressIftar: rootElement?.querySelector("[data-ramadan-progress-iftar]"),
      progressFill: rootElement?.querySelector("[data-ramadan-progress-fill]"),
      progressTrack: rootElement?.querySelector("[role=progressbar]"),
      tableGrid: rootElement?.querySelector("[data-ramadan-month-table-grid]"),
      tableMore: rootElement?.querySelector("[data-ramadan-table-more]"),
      tableActions: typeof rootElement?.querySelectorAll === "function"
        ? rootElement.querySelectorAll("[data-ramadan-table-action]")
        : [],
      headHijri: rootElement?.querySelector("[data-rt-head-hijri]"),
      headGregorian: rootElement?.querySelector("[data-rt-head-gregorian]"),
    };
  }

  function setTimetableState(elements, html, { hasData = false, showMore = false } = {}) {
    if (elements.tableGrid) elements.tableGrid.innerHTML = html;
    elements.tableActions?.forEach((button) => {
      if (button) button.disabled = !hasData;
      if (typeof button?.setAttribute === "function") {
        button.setAttribute("aria-disabled", String(!hasData));
      }
    });
    if (elements.tableMore) elements.tableMore.hidden = !showMore;
  }

  function renderStatus(elements, html) {
    if (elements.data) elements.data.innerHTML = html;
  }

  function clearDynamicValues(elements) {
    if (elements.month) elements.month.textContent = "—";
    if (elements.updated) elements.updated.textContent = "—";
    if (elements.dayLabel) elements.dayLabel.textContent = "اليوم";
    if (elements.day) elements.day.textContent = "—";
    if (elements.imsak) elements.imsak.textContent = "--:--";
    if (elements.iftar) elements.iftar.textContent = "--:--";
    if (elements.title) elements.title.textContent = "—";
    if (elements.hours) elements.hours.textContent = "--";
    if (elements.minutes) elements.minutes.textContent = "--";
    if (elements.seconds) elements.seconds.textContent = "--";
    if (elements.progressLabel) elements.progressLabel.textContent = "--%";
    if (elements.progressImsak) elements.progressImsak.textContent = "--:--";
    if (elements.progressIftar) elements.progressIftar.textContent = "--:--";
    if (elements.progressFill?.style) elements.progressFill.style.inlineSize = "0%";
    if (typeof elements.progressTrack?.setAttribute === "function") elements.progressTrack.setAttribute("aria-valuenow", "0");
    if (elements.tableGrid) elements.tableGrid.innerHTML = "";
    if (elements.headHijri) elements.headHijri.textContent = "—";
    if (elements.headGregorian) elements.headGregorian.textContent = "—";
  }

  function renderCountdown(elements) {
    const contract = state.contract;
    if (!contract?.nextEvent) {
      if (elements.title) elements.title.textContent = "—";
      if (elements.hours) elements.hours.textContent = "--";
      if (elements.minutes) elements.minutes.textContent = "--";
      if (elements.seconds) elements.seconds.textContent = "--";
      return;
    }

    const current = now();
    if (current.getTime() >= new Date(contract.nextEvent.occursAt).getTime()) {
      state.contract = recomputeRamadanNextEvent(contract, current);
    }

    const nextEvent = state.contract.nextEvent;
    if (elements.title) elements.title.textContent = getCountdownTitle(nextEvent);

    const remainingSeconds = computeRemainingSeconds(nextEvent.occursAt, now());
    const parts = formatRemaining(remainingSeconds);
    if (elements.hours) elements.hours.textContent = parts.hours;
    if (elements.minutes) elements.minutes.textContent = parts.minutes;
    if (elements.seconds) elements.seconds.textContent = parts.seconds;
    const progress = getProgressPercent(state.contract, current);
    if (elements.progressLabel) elements.progressLabel.textContent = `${progress}%`;
    if (elements.progressFill?.style) elements.progressFill.style.inlineSize = `${progress}%`;
    if (typeof elements.progressTrack?.setAttribute === "function") elements.progressTrack.setAttribute("aria-valuenow", String(progress));
  }

  function renderSuccess(elements) {
    const contract = state.contract;
    if (!contract) return "";

    if (elements.updated) {
      elements.updated.textContent = formatUpdatedMeta(
        contract.dateKey,
        contract.timezone,
        now(),
      );
    }

    if (contract.isRamadan) {
      if (elements.month) {
        elements.month.textContent = `${contract.hijriDate.monthName} ${contract.dateKey.slice(0, 4)}`;
      }
      if (elements.dayLabel) elements.dayLabel.textContent = "اليوم";
      if (elements.day) elements.day.textContent = String(contract.ramadanDay);
      if (elements.imsak) elements.imsak.textContent = contract.imsak ?? "--:--";
      if (elements.iftar) elements.iftar.textContent = contract.maghrib ?? "--:--";
      if (elements.progressImsak) elements.progressImsak.textContent = contract.imsak ?? "--:--";
      if (elements.progressIftar) elements.progressIftar.textContent = contract.maghrib ?? "--:--";

      renderCountdown(elements);

      if (elements.tableGrid) {
        setTimetableState(elements, renderRamadanMonthTableGrid({
          columns: RAMADAN_MONTH_TABLE_COLUMNS,
          rows: contract.monthRows,
          iconPaths: MONTH_TABLE_ICON_PATHS,
          locationLabel: state.location
            ? formatLocation(state.location)
            : "—",
          rangeLabel: contract.monthRangeLabel,
        }), { hasData: true, showMore: true });
      }

      if (elements.headHijri) {
        elements.headHijri.textContent = String(contract.hijriDate.year);
      }
      if (elements.headGregorian) {
        elements.headGregorian.textContent = contract.monthRangeLabel;
      }

      return "";
    }

    clearDynamicValues(elements);
    setTimetableState(elements, renderRamadanTimetableNoData());
    return renderRamadanOffSeasonState();
  }

  function isCurrentContractData() {
    if (!state.contract || !state.location) return false;
    return buildLoadKey(state.location) === loadKey;
  }

  function applyState() {
    const elements = getElements();
    if (!elements.city || !elements.data) return;

    elements.city.textContent = state.location
      ? formatLocation(state.location)
      : "دمشق، سوريا";

    if (state.status === "success" && state.contract) {
      renderStatus(elements, renderSuccess(elements));
      return;
    }

    // stale / error / empty while valid same-location data is present: keep
    // the rendered data and only surface the status.
    if (isCurrentContractData()) {
      const statusHtml = renderSuccess(elements);
      renderStatus(
        elements,
        state.status === "stale"
          ? renderRamadanRevalidatingState()
          : statusHtml,
      );
      return;
    }

    if (!state.location) {
      setTimetableState(elements, renderRamadanTimetableNoLocation());
    } else if (state.status === "loading" || state.status === "stale") {
      setTimetableState(elements, renderRamadanTimetableLoading());
    } else if (state.status === "error") {
      setTimetableState(elements, renderRamadanTimetableError());
    } else {
      setTimetableState(elements, renderRamadanTimetableNoData());
    }

    clearDynamicValues(elements);

    if (state.status === "empty") {
      renderStatus(elements, renderRamadanEmptyDataState());
    } else if (state.status === "error") {
      renderStatus(elements, renderRamadanErrorState());
    } else {
      renderStatus(elements, renderRamadanLoadingState());
    }
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
      const contract = await ramadanService.getByLocation(location);

      if (token !== sequence) return;

      if (!contract || typeof contract.dateKey !== "string") {
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

    if (state.status !== "success") return;

    const elements = getElements();
    renderCountdown(elements);
    if (elements.updated) {
      elements.updated.textContent = formatUpdatedMeta(
        state.contract.dateKey,
        state.contract.timezone,
        current,
      );
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
      if (!event.target?.closest?.("[data-ramadan-retry]")) return;
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

  if (!rootElement || !locationService || !ramadanService) {
    return Object.freeze({ destroy: () => {} });
  }

  bindRetry();
  countdownTimer = setInterval(tick, intervalMs);
  unsubscribe = locationService.subscribe(onLocationState);

  return Object.freeze({ destroy });
}
