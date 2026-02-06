import {
  getTimingsByCoords,
  getTimingsByCityAndCountry,
} from "../api/aladhan.api.js";

const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

const PRAYER_LABELS_AR = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

// Normalize time string to "HH:MM" format
function normalizeTime(timeStr) {
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

// Convert "HH:MM" time string to Date object for today
function timeToDateToday(hhmm, now = new Date()) {
  const [hhStr, mmStr] = hhmm.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  // date = today at HH:MM
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh,
    mm,
    0,
    0,
  );
}

// Get the next upcoming prayer from a list of prayers with times
function getNextPrayer(prayers, now = new Date()) {
  for (const p of prayers) {
    const dt = timeToDateToday(p.time, now);
    if (dt > now) {
      return {
        ...p,
        remainingMs: dt.getTime() - now.getTime(),
      };
    }
  }

  // If none left today, next is tomorrow's Fajr (assumes first item is Fajr)
  const first = prayers[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const dtTomorrow = timeToDateToday(first.time, tomorrow);

  return {
    ...first,
    remainingMs: dtTomorrow.getTime() - now.getTime(),
  };
}

// Build prayers array from timings object
function buildPrayersFromTimings(timings) {
  return PRAYER_ORDER.map((key) => ({
    key,
    label: PRAYER_LABELS_AR[key] ?? key,
    time: normalizeTime(timings[key]),
  }));
}

// Get today's prayer overview (prayers + next) by coordinates
export async function getTodayPrayerOverviewByCoords(latitude, longitude) {
  const timings = await getTimingsByCoords(latitude, longitude);

  const prayers = buildPrayersFromTimings(timings);
  const nextPrayer = getNextPrayer(prayers);

  return {
    prayers,
    nextPrayer,
  };
}
