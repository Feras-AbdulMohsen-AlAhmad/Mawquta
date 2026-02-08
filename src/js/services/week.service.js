import getMonthlyCalendarByCoords, {
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
  const calendarDays = await getMonthlyCalendarByCity(
    city,
    country,
    month,
    year,
  );

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
  const calendarDays = await getMonthlyCalendarByCoords(
    latitude,
    longitude,
    month,
    year,
  );

  return sliceWeekFromCalendar(calendarDays, dateObj);
}
