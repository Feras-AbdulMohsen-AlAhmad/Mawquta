import {
  getMonthlyCalendarByCoords,
  getMonthlyCalendarByCity,
} from "../api/aladhan.api.js";

import {
  requireValue,
  requireNumber,
  requireLongitude,
  requireLatitude,
  requireMonth,
  requireYear,
} from "../utils/validation.util.js";

import { getCache, setCache } from "../utils/cache.util.js";
import { CONFIG } from "../config.js";

// Helper to build a cache key for monthly calendar data
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

// Helper to extract year, month, day from Date object
function getDateParts(dateObj) {
  return {
    year: dateObj.getFullYear(),
    month: dateObj.getMonth() + 1, // 1..12
    day: dateObj.getDate(),
  };
}

// Get week slice (7 days) from monthly calendar starting from today's date
function sliceWeekFromCalendar(calendarDays, dateObj = new Date()) {
  if (!Array.isArray(calendarDays)) return [];

  // Get today's day of month
  const { day } = getDateParts(dateObj);

  // calendarDays: array for the month, index 0 => day 1
  const startIdx = Math.max(0, day - 1);

  // Get 7 days, or less if at month end
  const endIdx = Math.min(startIdx + 7, calendarDays.length);

  // Return the week slice
  return calendarDays.slice(startIdx, endIdx);
}

// Get current week by coordinates (latitude, longitude)
export async function getCurrentWeekByCity(
  city,
  country,
  dateObj = new Date(),
) {
  requireValue(city, "city");
  requireValue(country, "country");

  const { year, month } = getDateParts(dateObj);

  // Get monthly calendar for the city and country
  const cacheKey = buildCalendarCacheKey({
    type: "city",
    city,
    country,
    year,
    month,
  });
  let calendarDays = getCache(cacheKey);

  if (!calendarDays) {
    calendarDays = await getMonthlyCalendarByCity(city, country, month, year);
    setCache(cacheKey, calendarDays, CONFIG.CALENDAR_CACHE_TTL_MS);
  }

  return sliceWeekFromCalendar(calendarDays, dateObj);
}

export async function getCurrentWeekByCoords(
  latitude,
  longitude,
  dateObj = new Date(),
) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const { year, month } = getDateParts(dateObj);

  // Get monthly calendar for the coordinates
  const cacheKey = buildCalendarCacheKey({
    type: "coords",
    latitude,
    longitude,
    year,
    month,
  });
  let calendarDays = getCache(cacheKey);

  if (!calendarDays) {
    calendarDays = await getMonthlyCalendarByCoords(
      latitude,
      longitude,
      month,
      year,
    );
    setCache(cacheKey, calendarDays, CONFIG.CALENDAR_CACHE_TTL_MS);
  }

  return sliceWeekFromCalendar(calendarDays, dateObj);
}
