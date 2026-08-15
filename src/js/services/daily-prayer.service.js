// src/js/services/daily-prayer.service.js
// Builds the provider-independent Daily prayer contract from AlAdhan data.
//
// Strategy: calendar-first with a direct daily fallback. The primary path
// reuses the shared monthly calendar (week.service.js cache) so Daily and
// Weekly never issue a duplicate request for the same location+month. Only
// when the calendar is unavailable or the day data is incomplete does it fall
// back to the direct /timings endpoints.
//
// The module is free of browser/axios/DOM dependencies: provider functions are
// injected by the caller (main.js) or by tests, so it can run in Node.

import {
  validateTimeZone,
  getDateKeyInTimeZone,
  addDaysToDateKey,
  buildOccursAt,
  computeRemainingSeconds,
} from "../utils/time.util.js";
import {
  PRAYER_LABELS_AR_BY_KEY,
  normalizeTime,
} from "../utils/prayer-format.util.js";
import { buildDateInfo } from "../utils/date-format.util.js";
import {
  requireValue,
  requireLatitude,
  requireLongitude,
} from "../utils/validation.util.js";
import { CONFIG } from "../config/app.config.js";

export const DAILY_PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

// Maps contract keys to the raw AlAdhan timings keys.
const ALADHAN_TIMINGS_KEYS = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Builds the stable, comparable location key used across the Daily contract.
 * Example: "city:Damascus|Syria" or "coords:33.5138,36.2765".
 */
export function buildLocationKey(location) {
  if (!location || typeof location !== "object") {
    throw new Error("daily service: location is required");
  }

  const type = location.type === "coords" ? "coords" : "city";

  if (type === "coords") {
    const lat = Number(location.latitude).toFixed(4);
    const lon = Number(location.longitude).toFixed(4);
    return `coords:${lat},${lon}`;
  }

  requireValue(location.city, "city");
  requireValue(location.country, "country");
  return `city:${location.city}|${location.country}`;
}

function normalizePrayerTime(rawTime, prayerKey, dateKey) {
  const normalized = normalizeTime(rawTime);
  if (!TIME_PATTERN.test(normalized)) {
    throw new Error(
      `daily service: invalid time for ${prayerKey} on ${dateKey}`,
    );
  }
  return normalized;
}

/**
 * Builds the unified Daily contract from normalized inputs.
 * Pure and Node-testable.
 *
 * Inputs:
 * - timings: raw AlAdhan timings object (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha)
 * - dateKey: "YYYY-MM-DD" for the day in the location timezone
 * - timeZone: IANA timezone of the location
 * - locationKey: stable key produced by buildLocationKey
 * - now: current instant used for isPassed/isNext/nextPrayer
 * - nextDayFajr: optional "HH:MM" Fajr of the next day (from calendar data)
 * - dayData: optional raw calendar day object carrying `date.hijri`/`date.gregorian`
 *   used to build the dateInfo block for the Hero date card. When omitted the
 *   Hijri label degrades to a neutral placeholder (no conversion is attempted).
 */
export function buildDailyContract({
  timings,
  dateKey,
  timeZone,
  locationKey,
  now = new Date(),
  nextDayFajr = null,
  dayData = null,
}) {
  validateTimeZone(timeZone);

  if (!timings || typeof timings !== "object") {
    throw new Error("daily service: day data is missing timings");
  }

  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`daily service: invalid dateKey "${dateKey}"`);
  }

  const prayers = DAILY_PRAYER_KEYS.map((key) => {
    const rawTime = timings[ALADHAN_TIMINGS_KEYS[key]];
    const time = normalizePrayerTime(rawTime, key, dateKey);
    return {
      key,
      label: PRAYER_LABELS_AR_BY_KEY[key] ?? key,
      time,
      isNext: false,
      isPassed: false,
    };
  });

  const occursAtByKey = new Map(
    prayers.map((prayer) => [
      prayer.key,
      buildOccursAt({ dateKey, time: prayer.time, timeZone }),
    ]),
  );

  let nextPrayer = null;

  const nextToday = prayers.find((prayer) => {
    const occursAt = occursAtByKey.get(prayer.key);
    return occursAt.getTime() > now.getTime();
  });

  if (nextToday) {
    nextPrayer = {
      key: nextToday.key,
      label: nextToday.label,
      time: nextToday.time,
      occursAt: occursAtByKey.get(nextToday.key).toISOString(),
      remainingSeconds: computeRemainingSeconds(
        occursAtByKey.get(nextToday.key),
        now,
      ),
    };
  } else {
    // After Isha: the next prayer is tomorrow's Fajr. Use the calendar's
    // next-day Fajr when provided, otherwise approximate with today's Fajr.
    const tomorrowDateKey = addDaysToDateKey(dateKey, 1);
    const fajr = prayers[0];
    const tomorrowFajrTime = normalizePrayerTime(
      nextDayFajr ?? fajr.time,
      "fajr",
      tomorrowDateKey,
    );
    const occursAt = buildOccursAt({
      dateKey: tomorrowDateKey,
      time: tomorrowFajrTime,
      timeZone,
    });

    nextPrayer = {
      key: "fajr",
      label: fajr.label,
      time: tomorrowFajrTime,
      occursAt: occursAt.toISOString(),
      remainingSeconds: computeRemainingSeconds(occursAt, now),
    };
  }

  const updatedPrayers = prayers.map((prayer) => {
    const occursAt = occursAtByKey.get(prayer.key);
    const passed = occursAt.getTime() <= now.getTime();
    return {
      ...prayer,
      isPassed: passed,
      isNext: nextPrayer.key === prayer.key && !passed,
    };
  });

  return {
    dateKey,
    timezone: timeZone,
    locationKey,
    prayers: updatedPrayers,
    nextPrayer,
    dateInfo: buildDateInfo({
      dateKey,
      timeZone,
      dayData,
      updatedAt: now,
    }),
    fetchedAt: now.toISOString(),
  };
}

/**
 * Recomputes nextPrayer (and the prayers isNext/isPassed flags) for a given
 * instant without any network request. Used by the runtime when the current
 * next prayer passes and on countdown transitions.
 */
export function recomputeNextPrayer(contract, nowDate = new Date()) {
  if (
    !contract ||
    !Array.isArray(contract.prayers) ||
    contract.prayers.length === 0
  ) {
    return contract;
  }

  const { dateKey, timezone: timeZone, locationKey } = contract;

  const withOccursAt = contract.prayers.map((prayer) => ({
    ...prayer,
    occursAt: buildOccursAt({ dateKey, time: prayer.time, timeZone }),
  }));

  const nextToday = withOccursAt.find(
    (prayer) => prayer.occursAt.getTime() > nowDate.getTime(),
  );

  let nextPrayer;
  let updatedPrayers;

  if (nextToday) {
    nextPrayer = {
      key: nextToday.key,
      label: nextToday.label,
      time: nextToday.time,
      occursAt: nextToday.occursAt.toISOString(),
      remainingSeconds: computeRemainingSeconds(nextToday.occursAt, nowDate),
    };
    updatedPrayers = withOccursAt.map((prayer) => ({
      key: prayer.key,
      label: prayer.label,
      time: prayer.time,
      isPassed: prayer.occursAt.getTime() <= nowDate.getTime(),
      isNext: prayer.key === nextToday.key,
    }));
  } else {
    // All today's prayers passed: tomorrow's Fajr, approximated with today's
    // Fajr time (same-day as the last loaded contract; midnight triggers a
    // real reload which brings fresh calendar data).
    const tomorrowDateKey = addDaysToDateKey(dateKey, 1);
    const fajr = withOccursAt[0];
    const occursAt = buildOccursAt({
      dateKey: tomorrowDateKey,
      time: fajr.time,
      timeZone,
    });

    nextPrayer = {
      key: "fajr",
      label: fajr.label,
      time: fajr.time,
      occursAt: occursAt.toISOString(),
      remainingSeconds: computeRemainingSeconds(occursAt, nowDate),
    };
    updatedPrayers = withOccursAt.map((prayer) => ({
      key: prayer.key,
      label: prayer.label,
      time: prayer.time,
      isPassed: true,
      isNext: false,
    }));
  }

  return {
    ...contract,
    prayers: updatedPrayers,
    nextPrayer,
  };
}

function dateObjFromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameMonth(dateKeyA, dateKeyB) {
  return dateKeyA.slice(0, 7) === dateKeyB.slice(0, 7);
}

function isValidDay(dayObject) {
  return Boolean(
    dayObject &&
      typeof dayObject === "object" &&
      dayObject.timings &&
      typeof dayObject.timings === "object" &&
      dayObject.timings.Fajr,
  );
}

/**
 * Creates the Daily prayer service. Provider functions are injected so the
 * module stays Node-testable (aladhan.api.js requires window.axios).
 */
export function createDailyPrayerService(options = {}) {
  const {
    getTodayByCity,
    getTodayByCoords,
    getTimingsByCityAndCountry,
    getTimingsByCoords,
    now = () => new Date(),
  } = options;

  if (typeof getTodayByCity !== "function") {
    throw new Error("daily service: getTodayByCity is required");
  }
  if (typeof getTodayByCoords !== "function") {
    throw new Error("daily service: getTodayByCoords is required");
  }

  async function fetchTodayFromCalendar(location, dateObj) {
    if (location.type === "coords") {
      return getTodayByCoords(
        location.latitude,
        location.longitude,
        dateObj,
        false,
      );
    }
    return getTodayByCity(location.city, location.country, dateObj, false);
  }

  /**
   * Builds the unified Daily contract for the current instant in the given
   * location. Calendar-first with a direct daily fallback.
   */
  async function getByLocation(location) {
    if (!location || typeof location !== "object") {
      throw new Error("daily service: location is required");
    }

    const locationKey = buildLocationKey(location);
    const timeZone =
      typeof location.timezone === "string" && location.timezone.trim()
        ? location.timezone
        : CONFIG.TZ_FALLBACK;
    validateTimeZone(timeZone);

    const nowDate = now();
    const dateKey = getDateKeyInTimeZone(timeZone, nowDate);
    const todayDateObj = dateObjFromDateKey(dateKey);

    let contract = null;
    let sourceTimings = null;
    let dayObject = null;

    try {
      dayObject = await fetchTodayFromCalendar(location, todayDateObj);
      if (isValidDay(dayObject)) {
        sourceTimings = dayObject.timings;
        contract = buildDailyContract({
          timings: sourceTimings,
          dateKey,
          timeZone,
          locationKey,
          now: nowDate,
          dayData: dayObject,
        });
      }
    } catch {
      // Calendar path failed, day data incomplete or normalization rejected the
      // payload: fall through to the direct daily endpoint below.
      contract = null;
      sourceTimings = null;
    }

    if (!contract) {
      sourceTimings =
        location.type === "coords"
          ? await getTimingsByCoords(location.latitude, location.longitude)
          : await getTimingsByCityAndCountry(location.city, location.country);

      contract = buildDailyContract({
        timings: sourceTimings,
        dateKey,
        timeZone,
        locationKey,
        now: nowDate,
      });
    }

    // After Isha: try to enrich tomorrow's Fajr from the calendar data. Only
    // when tomorrow shares today's month (same cache key) so this never adds
    // a network request; otherwise keep the approximation.
    if (
      contract.prayers.every((prayer) => prayer.isPassed) &&
      isSameMonth(dateKey, addDaysToDateKey(dateKey, 1))
    ) {
      try {
        const tomorrowDateObj = dateObjFromDateKey(addDaysToDateKey(dateKey, 1));
        const nextDayObject = await fetchTodayFromCalendar(
          location,
          tomorrowDateObj,
        );
        if (isValidDay(nextDayObject)) {
          const nextDayFajr = normalizeTime(nextDayObject.timings.Fajr);
          if (TIME_PATTERN.test(nextDayFajr)) {
            contract = buildDailyContract({
              timings: sourceTimings,
              dateKey,
              timeZone,
              locationKey,
              now: nowDate,
              nextDayFajr,
              dayData: dayObject,
            });
          }
        }
      } catch {
        // Keep the approximation.
      }
    }

    return contract;
  }

  return Object.freeze({ getByLocation });
}
