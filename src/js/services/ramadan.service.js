import {
  convertGregorianDateToHijriDate,
  convertHijriDateToGregorianDate,
} from "../api/aladhan.api.js";

import { getLocalISODate } from "../utils/date.util.js";

// -------- Helpers --------

// Helper function to pad single-digit numbers with a leading zero e.g., 1 becomes "01"
function padTwoDigits(number) {
  return String(number).padStart(2, "0");
}

// Format a Date object as "DD-MM-YYYY"
function formatDateAsDDMMYYYY(dateObj) {
  const day = padTwoDigits(dateObj.getDate());
  const month = padTwoDigits(dateObj.getMonth() + 1);
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

// Set the time of a Date object to the start of the day (00:00:00)
function startOfDay(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Parse a date string in "DD-MM-YYYY" format into a Date object
function parseDDMMYYYY(dateStr) {
  const [dd, mm, yyyy] = dateStr.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

// -------- Main --------

export async function getRamadanCountdown(referenceDate = new Date()) {
  // 1) Today (Gregorian) -> string for API
  const todayGregorianStr = formatDateAsDDMMYYYY(referenceDate);

  // 2) Convert today to Hijri to know current Hijri month/year
  const todayHijri = await convertGregorianDateToHijriDate(todayGregorianStr);

  const currentHijriYear = Number(todayHijri.year);
  const currentHijriMonth = Number(todayHijri.month?.number);

  // Sanity check for valid Hijri conversion
  if (
    !Number.isFinite(currentHijriYear) ||
    !Number.isFinite(currentHijriMonth)
  ) {
    throw new Error("Hijri conversion returned invalid data");
  }

  // 3) Decide which Hijri year Ramadan should be in
  // Ramadan = month 9
  const nextRamadanHijriYear =
    currentHijriMonth < 9 ? currentHijriYear : currentHijriYear + 1;

  // 4) Build Hijri date for next Ramadan's start (1st of Ramadan)
  const ramadanStartHijriStr = `01-09-${nextRamadanHijriYear}`;

  // 5) Convert next Ramadan (Hijri) -> Gregorian date string
  const ramadanStartGregorian =
    await convertHijriDateToGregorianDate(ramadanStartHijriStr);
  const ramadanStartGregorianStr = ramadanStartGregorian.date; // "DD-MM-YYYY"

  // 6) Compute remaining days
  const today = startOfDay(referenceDate);
  const ramadanStart = startOfDay(parseDDMMYYYY(ramadanStartGregorianStr));

  // Calculate the difference in milliseconds and convert to days
  const differenceByMs = ramadanStart.getTime() - today.getTime();

  // Use Math.ceil to round up to the nearest whole day, and ensure it doesn't go negative
  const remainingDays = Math.max(
    0,
    Math.ceil(differenceByMs / (1000 * 60 * 60 * 24)),
  );

  // 7) Return the countdown data
  return {
    remainingDays,
    todayHijri: todayHijri.date, // "DD-MM-YYYY" (Hijri)
    ramadanStartHijri: ramadanStartHijriStr, // "01-09-YYYY"
    ramadanStartGregorian: ramadanStartGregorianStr, // "DD-MM-YYYY"
  };
}
