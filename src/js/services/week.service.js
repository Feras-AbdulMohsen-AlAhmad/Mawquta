/* =========================================================
   Imports
========================================================= */
import {
  getMonthlyCalendarByCoords,
  getMonthlyCalendarByCity,
} from "../api/aladhan.api.js";

import {
  requireValue,
  requireLongitude,
  requireLatitude,
} from "../utils/validation.util.js";

import { getCache, setCache } from "../utils/cache.util.js";
import { CONFIG } from "../config.js";

/* =========================================================
   Constants
========================================================= */
const WEEK_LENGTH = 7;

/* =========================================================
   Cache Key Helpers
========================================================= */
/**
 * Builds a stable cache key for monthly calendar data.
 * - For coords, rounds lat/lon to reduce cache fragmentation.
 * - For city, uses "city|country".
 */
function buildCalendarCacheKey({
  type,
  city,
  country,
  latitude,
  longitude,
  year,
  month,
}) {
  if (type === "coords") {
    const lat = Number(latitude).toFixed(4);
    const lon = Number(longitude).toFixed(4);
    return `cal:coords:${lat},${lon}:${year}-${month}`;
  }

  return `cal:city:${city}|${country}:${year}-${month}`;
}

/* =========================================================
   Date Helpers
========================================================= */
/**
 * Extracts {year, month, day} from a Date object.
 * Month is 1..12 (not JS zero-based).
 */
function getDateParts(dateObj = new Date()) {
  return {
    year: dateObj.getFullYear(),
    month: dateObj.getMonth() + 1,
    day: dateObj.getDate(),
  };
}

/**
 * Returns the next month/year pair (month is 1..12).
 */
function getNextMonth(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

/**
 * Calculates the start index for "today" inside the monthly calendar array.
 * Monthly calendar arrays are 0-based where index 0 => day 1.
 */
function getStartIndexForDate(dateObj = new Date()) {
  const { day } = getDateParts(dateObj);
  return Math.max(0, day - 1);
}

/* =========================================================
   Week Slicing Helpers
========================================================= */
/**
 * Returns exactly 7 days by taking the remainder of the current month slice
 * and completing it with the start of the next month if needed.
 */
function sliceWeekFromTwoMonths(
  currentMonthDays,
  nextMonthDays,
  dateObj = new Date(),
) {
  const startIdx = getStartIndexForDate(dateObj);
  const fromCurrent = currentMonthDays.slice(startIdx);

  if (fromCurrent.length >= WEEK_LENGTH) {
    return fromCurrent.slice(0, WEEK_LENGTH);
  }

  const remaining = WEEK_LENGTH - fromCurrent.length;
  const fromNext = nextMonthDays.slice(0, remaining);

  return fromCurrent.concat(fromNext);
}

/**
 * Checks if the current month alone can satisfy a 7-day slice
 * starting from today's index.
 */
function canSliceFullWeekFromCurrentMonth(
  currentMonthDays,
  dateObj = new Date(),
) {
  const startIdx = getStartIndexForDate(dateObj);
  return currentMonthDays.length - startIdx >= WEEK_LENGTH;
}

/**
 * Slices 7 days from current month only.
 */
function sliceWeekFromCurrentMonthOnly(currentMonthDays, dateObj = new Date()) {
  const startIdx = getStartIndexForDate(dateObj);
  return currentMonthDays.slice(startIdx, startIdx + WEEK_LENGTH);
}

/* =========================================================
   Calendar Fetch Helpers (with Cache)
========================================================= */
/**
 * Fetches a monthly calendar by city/country with optional cache bypass.
 */
async function fetchMonthlyCalendarByCity({
  city,
  country,
  year,
  month,
  bypassCache,
}) {
  const cacheKey = buildCalendarCacheKey({
    type: "city",
    city,
    country,
    year,
    month,
  });

  let calendarDays = bypassCache ? null : getCache(cacheKey);

  if (!calendarDays) {
    calendarDays = await getMonthlyCalendarByCity(city, country, month, year);
    setCache(cacheKey, calendarDays, CONFIG.CALENDAR_CACHE_TTL_MS);
  }

  return calendarDays;
}

/**
 * Fetches a monthly calendar by coords with optional cache bypass.
 */
async function fetchMonthlyCalendarByCoords({
  latitude,
  longitude,
  year,
  month,
  bypassCache,
}) {
  const cacheKey = buildCalendarCacheKey({
    type: "coords",
    latitude,
    longitude,
    year,
    month,
  });

  let calendarDays = bypassCache ? null : getCache(cacheKey);

  if (!calendarDays) {
    calendarDays = await getMonthlyCalendarByCoords(
      latitude,
      longitude,
      month,
      year,
    );
    setCache(cacheKey, calendarDays, CONFIG.CALENDAR_CACHE_TTL_MS);
  }

  return calendarDays;
}

/* =========================================================
   Public API
========================================================= */
/**
 * Returns the current week (7 days) for a given city/country.
 * If the week reaches the end of the month, it automatically pulls remaining days
 * from the next month to keep week length fixed at 7.
 */
export async function getCurrentWeekByCity(
  city,
  country,
  dateObj = new Date(),
  bypassCache = true,
) {
  requireValue(city, "city");
  requireValue(country, "country");

  const { year, month } = getDateParts(dateObj);

  const currentMonthDays = await fetchMonthlyCalendarByCity({
    city,
    country,
    year,
    month,
    bypassCache,
  });

  if (canSliceFullWeekFromCurrentMonth(currentMonthDays, dateObj)) {
    return sliceWeekFromCurrentMonthOnly(currentMonthDays, dateObj);
  }

  const { year: nextYear, month: nextMonth } = getNextMonth(year, month);

  const nextMonthDays = await fetchMonthlyCalendarByCity({
    city,
    country,
    year: nextYear,
    month: nextMonth,
    bypassCache,
  });

  return sliceWeekFromTwoMonths(currentMonthDays, nextMonthDays, dateObj);
}

/**
 * Returns the current week (7 days) for a given latitude/longitude.
 * If the week reaches the end of the month, it automatically pulls remaining days
 * from the next month to keep week length fixed at 7.
 */
export async function getCurrentWeekByCoords(
  latitude,
  longitude,
  dateObj = new Date(),
  bypassCache = true,
) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const { year, month } = getDateParts(dateObj);

  const currentMonthDays = await fetchMonthlyCalendarByCoords({
    latitude,
    longitude,
    year,
    month,
    bypassCache,
  });

  if (canSliceFullWeekFromCurrentMonth(currentMonthDays, dateObj)) {
    return sliceWeekFromCurrentMonthOnly(currentMonthDays, dateObj);
  }

  const { year: nextYear, month: nextMonth } = getNextMonth(year, month);

  const nextMonthDays = await fetchMonthlyCalendarByCoords({
    latitude,
    longitude,
    year: nextYear,
    month: nextMonth,
    bypassCache,
  });

  return sliceWeekFromTwoMonths(currentMonthDays, nextMonthDays, dateObj);
}
