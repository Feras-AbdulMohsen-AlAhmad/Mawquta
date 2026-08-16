// src/js/services/weekly-formatter.service.js
// Pure helpers that turn a raw AlAdhan weekly calendar slice (7 day objects
// produced by week.service.js) into the UI contract consumed by the weekly
// prayer section. Kept free of browser/axios dependencies so it can be
// tested directly in Node.

import {
  PRAYER_LABELS_AR_BY_KEY,
  formatPrayerTimeForDisplay,
  normalizeTime,
} from "../utils/prayer-format.util.js";

export const WEEK_LENGTH = 7;

export const PRAYER_COLUMN_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const ARABIC_MONTH_NAMES = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};

const WEEKDAY_AR_FALLBACK = {
  Sunday: "الأحد",
  Monday: "الاثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
  Friday: "الجمعة",
  Saturday: "السبت",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getDatePartsInTimeZone(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const find = (type) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(find("year")),
    month: Number(find("month")),
    day: Number(find("day")),
  };
}

/**
 * Returns the "YYYY-MM-DD" key for today in the given timezone.
 */
export function getTodayDateKey(timeZone, now = new Date()) {
  const { year, month, day } = getDatePartsInTimeZone(timeZone, now);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Returns a Date whose local y/m/d parts equal today's date in the given
 * timezone. Used as the week window anchor for week.service.js.
 */
export function getTodayDateInTimeZone(timeZone, now = new Date()) {
  const { year, month, day } = getDatePartsInTimeZone(timeZone, now);
  return new Date(year, month - 1, day);
}

function getGregorianParts(dayObject) {
  const gregorian = dayObject?.date?.gregorian;
  if (!gregorian || typeof gregorian !== "object") {
    throw new Error("weekly formatter: day is missing gregorian date");
  }

  const year = Number(gregorian.year);
  const month = Number(gregorian.month?.number);
  const day = Number(gregorian.day);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("weekly formatter: day has invalid gregorian date");
  }

  return { year, month, day };
}

function getArabicDayName(dayObject) {
  const weekday = dayObject?.date?.gregorian?.weekday;
  const arabicName = typeof weekday?.ar === "string" ? weekday.ar.trim() : "";
  if (arabicName) return arabicName;

  const hijriWeekdayAr = dayObject?.date?.hijri?.weekday?.ar;
  if (typeof hijriWeekdayAr === "string" && hijriWeekdayAr.trim()) {
    return hijriWeekdayAr.trim();
  }

  const fallback = WEEKDAY_AR_FALLBACK[weekday?.en];
  if (fallback) return fallback;

  throw new Error("weekly formatter: day is missing weekday name");
}

function normalizePrayerTime(rawTime, prayerKey, dateKey) {
  const normalized = normalizeTime(rawTime);
  if (!TIME_PATTERN.test(normalized)) {
    throw new Error(
      `weekly formatter: invalid time for ${prayerKey} on ${dateKey}`,
    );
  }
  return normalized;
}

function buildRow(dayObject, index, todayDateKey) {
  if (!dayObject || typeof dayObject !== "object") {
    throw new Error(`weekly formatter: invalid day at index ${index}`);
  }

  const { year, month, day } = getGregorianParts(dayObject);
  const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;

  const timings = dayObject.timings;
  if (!timings || typeof timings !== "object") {
    throw new Error(`weekly formatter: day ${dateKey} is missing timings`);
  }

  return {
    dateKey,
    day: getArabicDayName(dayObject),
    date: `${ARABIC_MONTH_NAMES[month] ?? month} ${day}`,
    dateLabel: `${day} ${ARABIC_MONTH_NAMES[month] ?? month}`,
    fajr: normalizePrayerTime(timings.Fajr, "fajr", dateKey),
    dhuhr: normalizePrayerTime(timings.Dhuhr, "dhuhr", dateKey),
    asr: normalizePrayerTime(timings.Asr, "asr", dateKey),
    maghrib: normalizePrayerTime(timings.Maghrib, "maghrib", dateKey),
    isha: normalizePrayerTime(timings.Isha, "isha", dateKey),
    isToday: dateKey === todayDateKey,
  };
}

/**
 * Builds the ordered week rows (exactly 7) from the raw calendar slice.
 */
export function buildWeeklyRows({ calendarDays, timeZone, now = new Date() }) {
  if (!Array.isArray(calendarDays)) {
    throw new Error("weekly formatter: calendarDays must be an array");
  }
  if (calendarDays.length !== WEEK_LENGTH) {
    throw new Error(
      `weekly formatter: expected ${WEEK_LENGTH} days but got ${calendarDays.length}`,
    );
  }

  const todayDateKey = getTodayDateKey(timeZone, now);

  return calendarDays.map((dayObject, index) =>
    buildRow(dayObject, index, todayDateKey),
  );
}

/**
 * Builds the range label shown next to the week title, e.g. "23 - 29 مارس 2026".
 * Uses the first row's month/year for the label.
 */
export function buildWeekRangeText(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("weekly formatter: cannot build range from empty rows");
  }

  const firstDateKey = rows[0].dateKey;
  const lastDateKey = rows[rows.length - 1].dateKey;
  const month = Number(firstDateKey.slice(5, 7));
  const year = firstDateKey.slice(0, 4);

  const monthName = ARABIC_MONTH_NAMES[month] ?? month;
  return `${monthName} ${Number(firstDateKey.slice(8, 10))} - ${monthName} ${Number(lastDateKey.slice(8, 10))} , ${year}`;
}

/**
 * Returns the prayer key that is currently in progress (the latest prayer whose
 * time has already passed) for today in the given timezone, or null.
 */
export function computeActivePrayerKey({ rows, timeZone, now = new Date() }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const todayDateKey = getTodayDateKey(timeZone, now);
  const todayRow = rows.find((row) => row.dateKey === todayDateKey) || rows[0];

  const nowParts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(nowParts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    nowParts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const nowMinutes = hour * 60 + minute;

  let activeKey = null;
  for (const key of PRAYER_COLUMN_KEYS) {
    const [hh, mm] = String(todayRow[key] ?? "").split(":").map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      if (hh * 60 + mm <= nowMinutes) activeKey = key;
    }
  }

  return activeKey;
}

/**
 * Builds the mobile card for today's row (falls back to the first row).
 */
export function buildMobileCard({ rows, timeZone, now = new Date() }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const todayDateKey = getTodayDateKey(timeZone, now);
  const todayRow = rows.find((row) => row.dateKey === todayDateKey) || rows[0];
  const hasToday = todayRow?.dateKey === todayDateKey;
  const activeKey = hasToday
    ? todayRow.activePrayer ?? computeActivePrayerKey({ rows, timeZone, now })
    : null;

  return {
    day: todayRow.day,
    date: todayRow.dateLabel ?? todayRow.date,
    badge: hasToday ? "اليوم" : "",
    prayers: PRAYER_COLUMN_KEYS.map((key) => ({
      key,
      label: PRAYER_LABELS_AR_BY_KEY[key] ?? key,
      time: formatPrayerTimeForDisplay(todayRow[key]),
      isActive: hasToday && key === activeKey,
    })),
  };
}

/**
 * Builds the full section data contract for the weekly prayer section.
 */
export function buildWeeklySectionData({
  calendarDays,
  timeZone,
  now = new Date(),
}) {
  if (!timeZone) {
    throw new Error("weekly formatter: timeZone is required");
  }

  const rows = buildWeeklyRows({ calendarDays, timeZone, now });
  const todayDateKey = getTodayDateKey(timeZone, now);
  const todayIndex = rows.findIndex((row) => row.dateKey === todayDateKey);
  const activeKey = computeActivePrayerKey({ rows, timeZone, now });

  if (todayIndex >= 0) {
    rows[todayIndex] = { ...rows[todayIndex], activePrayer: activeKey };
  }

  const rangeText = buildWeekRangeText(rows);
  const mobileCard = buildMobileCard({ rows, timeZone, now });

  return { rows, rangeText, mobileCard };
}
