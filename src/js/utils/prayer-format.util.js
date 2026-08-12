// src/js/utils/prayer-format.util.js
// Shared prayer time formatting helpers used by daily-prayer.service.js and
// weekly-formatter.service.js. Extracted to keep the weekly formatter pure
// (Node-testable) without pulling in the axios-coupled aladhan.api.js.

export const PRAYER_LABELS_AR = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

// Normalize time string to "HH:MM" format
export function normalizeTime(timeStr) {
  if (typeof timeStr !== "string") return "";

  // Examples:
  // "05:12 (+03)" -> "05:12"
  // "05:12"       -> "05:12"
  const trimmed = timeStr.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);

  if (!match) return trimmed;

  const hh = match[1].padStart(2, "0");
  const mm = match[2];

  return `${hh}:${mm}`;
}

/** Formats normalized 24-hour prayer data in the Weekly Prayer Figma style. */
export function formatPrayerTimeForDisplay(timeStr) {
  const normalized = normalizeTime(timeStr);
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return normalized;

  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${match[2]} ${suffix}`;
}
