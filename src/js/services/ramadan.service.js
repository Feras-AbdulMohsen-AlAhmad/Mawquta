// src/js/services/ramadan.service.js
// Builds the provider-independent Ramadan contract from the shared AlAdhan
// monthly calendar (week.service.js `cal:*` cache + in-flight dedupe).
// Calendar-first only: the Imsak time and the Hijri month/day exist only in the
// monthly calendar payload, so there is deliberately no direct /timings
// fallback and no gToH/hToG conversion endpoint.
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
import { normalizeTime } from "../utils/prayer-format.util.js";
import { buildLocationKey } from "./daily-prayer.service.js";
import { CONFIG } from "../config/app.config.js";

/* =========================================================
   Constants
========================================================= */
const HIJRI_RAMADAN_MONTH = 9;
const RAMADAN_MONTH_NAME = "رمضان";

const ARABIC_DIACRITICS_PATTERN = /[\u064B-\u0652\u0670]/g;

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

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const TABLE_PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const ALADHAN_TIMINGS_KEYS = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

/* =========================================================
   Small helpers
========================================================= */
function normalizeRamadanTime(rawTime, field, dateKey) {
  const normalized = normalizeTime(rawTime);
  if (!TIME_PATTERN.test(normalized)) {
    throw new Error(`ramadan service: invalid time for ${field} on ${dateKey}`);
  }
  return normalized;
}

function stripDiacritics(value) {
  return String(value ?? "").replace(ARABIC_DIACRITICS_PATTERN, "");
}

function normalizeHijriMonthName(rawName) {
  const cleaned = stripDiacritics(rawName);
  return cleaned || RAMADAN_MONTH_NAME;
}

/**
 * Converts an AlAdhan gregorian date string ("DD-MM-YYYY") into a
 * "YYYY-MM-DD" key. Returns null when the shape is not recognized.
 */
function gregorianToDateKey(gregorianDate) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(gregorianDate ?? ""));
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function dateObjFromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function adjacentMonthDateObj(dateKey, monthOffset) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(year, month - 1 + monthOffset, 1);
}

function getDayIndex(monthDays, dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
  return (monthDays ?? []).findIndex(
    (dayObject) => dayObject?.date?.gregorian?.date === target,
  );
}

function findDayForDateKey(monthDays, dateKey) {
  const index = getDayIndex(monthDays, dateKey);
  return index < 0 ? null : (monthDays?.[index] ?? null);
}

function isRamadanDayObject(dayObject) {
  return Number(dayObject?.date?.hijri?.month?.number) === HIJRI_RAMADAN_MONTH;
}

function getWeekdayName(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return AR_WEEKDAYS[dow];
}

function getMonthRangeLabel(dateKey, rows = []) {
  const rangeKeys = rows.length
    ? [rows[0].dateKey, rows[rows.length - 1].dateKey]
    : [dateKey, dateKey];
  const [startYear, startMonth] = rangeKeys[0].split("-").map(Number);
  const [endYear, endMonth] = rangeKeys[1].split("-").map(Number);

  if (startYear === endYear && startMonth === endMonth) {
    return `${AR_MONTHS[startMonth - 1]} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${AR_MONTHS[startMonth - 1]} – ${AR_MONTHS[endMonth - 1]} ${startYear}`;
  }
  return `${AR_MONTHS[startMonth - 1]} ${startYear} – ${AR_MONTHS[endMonth - 1]} ${endYear}`;
}

function formatTableDate(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

function findImsakForDateKey(monthDays, dateKey) {
  const dayObject = findDayForDateKey(monthDays, dateKey);
  if (!isRamadanDayObject(dayObject)) return null;
  const normalized = normalizeTime(dayObject?.timings?.Imsak);
  return TIME_PATTERN.test(normalized) ? normalized : null;
}

function mergeCalendarMonths(monthGroups) {
  const byDate = new Map();
  for (const dayObject of monthGroups.flat()) {
    const date = dayObject?.date?.gregorian?.date;
    if (date) byDate.set(date, dayObject);
  }
  return [...byDate.values()].sort((a, b) => {
    const aKey = gregorianToDateKey(a?.date?.gregorian?.date) ?? "";
    const bKey = gregorianToDateKey(b?.date?.gregorian?.date) ?? "";
    return aKey.localeCompare(bKey);
  });
}

function getAdjacentRamadanMonthsNeeded(monthDays) {
  if (!Array.isArray(monthDays) || monthDays.length === 0) {
    return { previous: false, next: false };
  }

  const firstDay = monthDays[0];
  const lastDay = monthDays[monthDays.length - 1];
  const firstRamadanDay = Number(firstDay?.date?.hijri?.day);
  const lastRamadanDay = Number(lastDay?.date?.hijri?.day);

  return {
    previous: isRamadanDayObject(firstDay) && firstRamadanDay > 1,
    next: isRamadanDayObject(lastDay) && lastRamadanDay < 30,
  };
}

/* =========================================================
   Month table rows
========================================================= */
function computeActivePrayerKeys(times, nowHm) {
  const active = [];
  let next = null;

  for (const key of TABLE_PRAYER_KEYS) {
    if (times[key] <= nowHm) {
      active.push(key);
    } else if (next === null) {
      next = key;
    }
  }

  if (next) active.push(next);
  return active;
}

/**
 * Builds the month-table rows for Ramadan days that fall inside the current
 * Gregorian month. Rows are display-aligned with the existing table components
 * (day/weekday, date/gregorianDate, ramadanDayNumber/ramadanDay mapping is
 * handled by the grid component). Only the current month calendar is used —
 * no full-Hijri or second-Gregorian-month fetch.
 */
function buildMonthRows({ monthDays, dateKey, timeZone, now }) {
  const rows = [];
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const find = (type) =>
    todayParts.find((part) => part.type === type)?.value ?? "00";
  const nowHm = `${find("hour")}:${find("minute")}`;

  for (const dayObject of monthDays ?? []) {
    if (!dayObject?.date?.hijri?.month) continue;
    if (Number(dayObject.date.hijri.month.number) !== HIJRI_RAMADAN_MONTH) {
      continue;
    }

    const rowDateKey = gregorianToDateKey(dayObject.date.gregorian?.date);
    if (!rowDateKey) continue;
    const ramadanDay = Number(dayObject.date.hijri.day);
    if (!Number.isInteger(ramadanDay) || ramadanDay < 1 || ramadanDay > 30) {
      continue;
    }

    const times = {};
    let hasValidTimes = true;
    for (const key of TABLE_PRAYER_KEYS) {
      const normalized = normalizeTime(
        dayObject.timings?.[ALADHAN_TIMINGS_KEYS[key]],
      );
      if (!TIME_PATTERN.test(normalized)) {
        hasValidTimes = false;
        break;
      }
      times[key] = normalized;
    }
    if (!hasValidTimes) continue;

    const isToday = rowDateKey === dateKey;

    rows.push({
      dateKey: rowDateKey,
      gregorianDate: formatTableDate(rowDateKey),
      weekday: getWeekdayName(rowDateKey),
      ramadanDay,
      fajr: times.fajr,
      dhuhr: times.dhuhr,
      asr: times.asr,
      maghrib: times.maghrib,
      isha: times.isha,
      isToday,
      activePrayerKeys: isToday ? computeActivePrayerKeys(times, nowHm) : [],
    });
  }

  return rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/* =========================================================
   Next event semantics
========================================================= */
function buildEvent(key, label, time, dateKey, timeZone, now) {
  const occursAt = buildOccursAt({ dateKey, time, timeZone });
  return {
    key,
    label,
    time,
    occursAt: occursAt.toISOString(),
    remainingSeconds: computeRemainingSeconds(occursAt, now),
  };
}

/**
 * Countdown window:
 * - before today's Imsak           -> Imsak
 * - Imsak..Maghrib                 -> Maghrib (iftar)
 * - after Maghrib                  -> next-day Imsak (real calendar value when
 *   the next day lies in the same cached month, otherwise today's Imsak time
 *   as an approximation until the midnight reload brings the fresh day).
 */
function buildNextEvent({
  imsak,
  maghrib,
  dateKey,
  timeZone,
  now,
  nextDayImsak = null,
  hasNextRamadanDay = true,
}) {
  const imsakOccursAt = buildOccursAt({ dateKey, time: imsak, timeZone });

  if (now.getTime() < imsakOccursAt.getTime()) {
    return buildEvent("imsak", "الإمساك", imsak, dateKey, timeZone, now);
  }

  const maghribOccursAt = buildOccursAt({ dateKey, time: maghrib, timeZone });
  if (now.getTime() < maghribOccursAt.getTime()) {
    return buildEvent("maghrib", "الإفطار", maghrib, dateKey, timeZone, now);
  }

  if (!hasNextRamadanDay) return null;

  const tomorrowKey = addDaysToDateKey(dateKey, 1);
  const tomorrowImsak = nextDayImsak ?? imsak;
  return buildEvent("imsak", "الإمساك", tomorrowImsak, tomorrowKey, timeZone, now);
}

/* =========================================================
   Public API
========================================================= */
/**
 * Builds the unified Ramadan contract from normalized inputs. Pure and
 * Node-testable.
 *
 * Inputs:
 * - dayObject: raw AlAdhan monthly-calendar day for "today" in the location
 *   timezone (timings + date.hijri + date.gregorian).
 * - dateKey: "YYYY-MM-DD" for today in the location timezone.
 * - timeZone: IANA timezone of the location.
 * - locationKey: stable key produced by buildLocationKey.
 * - now: current instant used for nextEvent/countdown and isToday rows.
 * - monthDays: the full current Gregorian month array (shared calendar cache)
 *   used for monthRows and the same-month next-day Imsak.
 */
export function buildRamadanContract({
  dayObject,
  dateKey,
  timeZone,
  locationKey,
  now = new Date(),
  monthDays = [],
}) {
  validateTimeZone(timeZone);

  if (!dayObject || typeof dayObject !== "object") {
    throw new Error("ramadan service: day data is required");
  }
  if (!dayObject.date?.hijri?.month) {
    throw new Error(
      "ramadan service: calendar day payload is missing hijri data",
    );
  }
  if (!dayObject.timings || typeof dayObject.timings !== "object") {
    throw new Error(
      "ramadan service: calendar day payload is missing timings",
    );
  }

  const hijriMonthNumber = Number(dayObject.date.hijri.month.number);
  if (
    !Number.isInteger(hijriMonthNumber) ||
    hijriMonthNumber < 1 ||
    hijriMonthNumber > 12
  ) {
    throw new Error("ramadan service: invalid hijri month number");
  }

  const isRamadan = hijriMonthNumber === HIJRI_RAMADAN_MONTH;

  const hijriDay = Number(dayObject.date.hijri.day);
  const hijriYear = Number(dayObject.date.hijri.year);
  if (!Number.isInteger(hijriDay) || hijriDay < 1 || hijriDay > 30) {
    throw new Error("ramadan service: invalid hijri day");
  }
  if (!Number.isInteger(hijriYear) || hijriYear < 1) {
    throw new Error("ramadan service: invalid hijri year");
  }
  const monthName = normalizeHijriMonthName(dayObject.date.hijri.month.ar);

  const imsak = normalizeRamadanTime(dayObject.timings.Imsak, "Imsak", dateKey);
  const fajr = normalizeRamadanTime(dayObject.timings.Fajr, "Fajr", dateKey);
  const maghrib = normalizeRamadanTime(
    dayObject.timings.Maghrib,
    "Maghrib",
    dateKey,
  );
  const isha = normalizeRamadanTime(dayObject.timings.Isha, "Isha", dateKey);

  const monthRows = buildMonthRows({ monthDays, dateKey, timeZone, now });
  const monthRangeLabel = getMonthRangeLabel(dateKey, monthRows);

  // Same-month next-day Imsak for the after-Maghrib countdown window. Real
  // value when the next Gregorian day shares this month (cache-safe, no extra
  // request), null otherwise (midnight reload brings the fresh month).
  const tomorrowKey = addDaysToDateKey(dateKey, 1);
  const tomorrowDayObject = findDayForDateKey(monthDays, tomorrowKey);
  const isFinalRamadanDay = isRamadan && (
    hijriDay === 30 ||
    (tomorrowDayObject !== null && !isRamadanDayObject(tomorrowDayObject))
  );
  const hasNextRamadanDay = isRamadan && !isFinalRamadanDay;
  const nextDayImsak = findImsakForDateKey(monthDays, tomorrowKey);

  const nextEvent = isRamadan
    ? buildNextEvent({
        imsak,
        maghrib,
        dateKey,
        timeZone,
        now,
        nextDayImsak,
        hasNextRamadanDay,
      })
    : null;

  return {
    dateKey,
    timezone: timeZone,
    locationKey,
    isRamadan,
    hijriDate: {
      day: hijriDay,
      month: hijriMonthNumber,
      monthName,
      year: hijriYear,
    },
    ramadanDay: isRamadan ? hijriDay : null,
    imsak: isRamadan ? imsak : null,
    fajr: isRamadan ? fajr : null,
    maghrib: isRamadan ? maghrib : null,
    isha: isRamadan ? isha : null,
    nextEvent,
    isFinalRamadanDay,
    // Helper field: the same-month next-day Imsak ("HH:MM" | null) used by
    // recomputeRamadanNextEvent to keep the offline after-Maghrib transition
    // stable without any network request.
    nextDayImsak: isRamadan ? nextDayImsak : null,
    monthRows,
    monthRangeLabel,
    fetchedAt: now.toISOString(),
  };
}

/**
 * Recomputes nextEvent (and remainingSeconds) for a given instant without any
 * network request. Used by the runtime on every countdown tick and on event
 * transitions (Imsak -> Maghrib -> next-day Imsak).
 */
export function recomputeRamadanNextEvent(contract, nowDate = new Date()) {
  if (!contract || !contract.isRamadan || !contract.imsak || !contract.maghrib) {
    return contract;
  }

  const nextEvent = buildNextEvent({
    imsak: contract.imsak,
    maghrib: contract.maghrib,
    dateKey: contract.dateKey,
    timeZone: contract.timezone,
    now: nowDate,
    nextDayImsak: contract.nextDayImsak ?? null,
    hasNextRamadanDay: !contract.isFinalRamadanDay,
  });

  return { ...contract, nextEvent };
}

/**
 * Creates the Ramadan service. Provider functions are injected so the module
 * stays Node-testable (aladhan.api.js requires window.axios). Calendar-first:
 * today's day and the current month come from the shared monthly calendar, so
 * Daily, Weekly and Ramadan share one request per location+month.
 */
export function createRamadanService(options = {}) {
  const {
    getTodayByCity,
    getTodayByCoords,
    getMonthCalendarByCity,
    getMonthCalendarByCoords,
    now = () => new Date(),
  } = options;

  if (typeof getTodayByCity !== "function") {
    throw new Error("ramadan service: getTodayByCity is required");
  }
  if (typeof getTodayByCoords !== "function") {
    throw new Error("ramadan service: getTodayByCoords is required");
  }
  if (typeof getMonthCalendarByCity !== "function") {
    throw new Error("ramadan service: getMonthCalendarByCity is required");
  }
  if (typeof getMonthCalendarByCoords !== "function") {
    throw new Error("ramadan service: getMonthCalendarByCoords is required");
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

  async function fetchMonthFromCalendar(location, dateObj) {
    if (location.type === "coords") {
      return getMonthCalendarByCoords(
        location.latitude,
        location.longitude,
        dateObj,
        false,
      );
    }
    return getMonthCalendarByCity(location.city, location.country, dateObj, false);
  }

  /**
   * Builds the unified Ramadan contract for the current instant in the given
   * location. Both the day and the month come from the shared monthly calendar
   * (same `cal:*` cache key and in-flight dedupe as Weekly and Daily), so this
   * never issues a parallel provider request.
   */
  async function getByLocation(location) {
    if (!location || typeof location !== "object") {
      throw new Error("ramadan service: location is required");
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

    const dayObject = await fetchTodayFromCalendar(location, todayDateObj);
    const currentMonthDays = await fetchMonthFromCalendar(location, todayDateObj);
    let monthDays = currentMonthDays;

    if (isRamadanDayObject(dayObject)) {
      const needed = getAdjacentRamadanMonthsNeeded(currentMonthDays);
      const adjacentRequests = [];
      if (needed.previous) {
        adjacentRequests.push(
          fetchMonthFromCalendar(location, adjacentMonthDateObj(dateKey, -1)),
        );
      }
      if (needed.next) {
        adjacentRequests.push(
          fetchMonthFromCalendar(location, adjacentMonthDateObj(dateKey, 1)),
        );
      }
      if (adjacentRequests.length) {
        monthDays = mergeCalendarMonths([
          currentMonthDays,
          ...(await Promise.all(adjacentRequests)),
        ]);
      }
    }

    return buildRamadanContract({
      dayObject,
      dateKey,
      timeZone,
      locationKey,
      now: nowDate,
      monthDays,
    });
  }

  return Object.freeze({ getByLocation });
}

export { buildLocationKey } from "./daily-prayer.service.js";
