// Shared fixtures for the S4-T10 full-runtime integration harness.
// Builds AlAdhan monthly-calendar day objects with Imsak + Hijri month control
// so unit, runtime and browser tests reuse the same payload shapes.

const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const DEFAULT_TIMINGS = {
  Imsak: "04:50",
  Fajr: "05:00",
  Sunrise: "06:00",
  Dhuhr: "12:30",
  Asr: "15:45",
  Maghrib: "18:30",
  Isha: "20:00",
};

// Canonical Damascus March 2026 Ramadan times used by the spec example.
export const CANONICAL_TIMINGS = {
  Imsak: "05:28",
  Fajr: "05:38",
  Sunrise: "06:00",
  Dhuhr: "12:45",
  Asr: "16:08",
  Maghrib: "18:43",
  Isha: "19:51",
};

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function makeDay({
  year,
  month,
  day,
  times,
  hijriMonth = 9,
  hijriDay,
  hijriYear = 1447,
  hijriMonthAr = "رَمَضان",
  weekdayEn,
  weekdayAr,
}) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dow = dt.getUTCDay();
  const timings = { ...DEFAULT_TIMINGS, ...(times || {}) };
  const isRamadan = Number(hijriMonth) === 9;
  return {
    timings,
    date: {
      gregorian: {
        date: `${pad2(day)}-${pad2(month)}-${year}`,
        day: pad2(day),
        month: { number: month },
        year: String(year),
        weekday: {
          en: weekdayEn || WEEKDAYS_EN[dow],
          ar: weekdayAr || WEEKDAYS_AR[dow],
        },
      },
      hijri: {
        day: String(hijriDay ?? day),
        month: {
          number: hijriMonth,
          ar: hijriMonthAr,
          en: isRamadan ? "Ramadan" : "Shawwal",
        },
        year: String(hijriYear),
        weekday: { en: "Monday", ar: "الاثنين" },
      },
    },
  };
}

/**
 * Builds a full Gregorian month of calendar days.
 * @param {object} opts
 * @param {number} opts.year  Gregorian year of the month
 * @param {number} opts.month Gregorian month (1..12)
 * @param {number} [opts.hijriMonth] Hijri month for every day (default 9)
 * @param {number} [opts.hijriDayOffset] Added to the Gregorian day to derive
 *   the Hijri day (default 0).
 * @param {string} [opts.hijriMonthAr] Hijri month Arabic name.
 * @param {(day:number)=>object} [opts.timesFor] Optional per-day times override.
 */
export function makeMonthCalendar({
  year,
  month,
  hijriMonth = 9,
  hijriDayOffset = 0,
  hijriMonthAr = "رَمَضان",
  timesFor,
} = {}) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(
      makeDay({
        year,
        month,
        day,
        hijriMonth,
        hijriDay: day + hijriDayOffset,
        hijriMonthAr,
        times: timesFor ? timesFor(day) : undefined,
      }),
    );
  }
  return days;
}

/**
 * Builds a Gregorian month whose first `ramadanDays` days are Ramadan
 * (hijri month 9) and the remaining days are Shawwal (hijri month 10).
 */
export function makeMixedMonth({ year, month, ramadanDays, times }) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const isRamadanDay = day <= ramadanDays;
    days.push(
      makeDay({
        year,
        month,
        day,
        hijriMonth: isRamadanDay ? 9 : 10,
        hijriDay: day,
        hijriMonthAr: isRamadanDay ? "رَمَضان" : "شَوَّال",
        times,
      }),
    );
  }
  return days;
}

/**
 * Builds a fixed 7-day slice (for weekly runtime provider stubs). Starts at
 * `startDay` (1-based) of the given month and wraps nothing: the caller must
 * choose a startDay that leaves >= 7 days in the month.
 */
export function makeWeekSlice({
  year,
  month,
  startDay,
  hijriMonth = 9,
  times,
} = {}) {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(
      makeDay({
        year,
        month,
        day: startDay + i,
        hijriMonth,
        hijriDay: startDay + i,
        times,
      }),
    );
  }
  return days;
}

/**
 * Standard providers for createRamadanService tests. All reads go through the
 * injected month-calendar providers (calendar-first, no direct endpoints).
 */
export function makeProviders(monthDays, callLog = []) {
  const byDate = new Map(
    monthDays.map((dayObject) => [dayObject.date.gregorian.date, dayObject]),
  );
  const pick = (dateObj) => {
    const key = `${pad2(dateObj.getDate())}-${pad2(dateObj.getMonth() + 1)}-${dateObj.getFullYear()}`;
    const dayObject = byDate.get(key);
    if (!dayObject) throw new Error(`no mock calendar day for ${key}`);
    return dayObject;
  };
  return {
    callLog,
    async getTodayByCity(city, country, dateObj, bypassCache) {
      callLog.push({ name: "getTodayByCity", city, country, bypassCache });
      return pick(dateObj);
    },
    async getTodayByCoords(latitude, longitude, dateObj, bypassCache) {
      callLog.push({ name: "getTodayByCoords", latitude, longitude, bypassCache });
      return pick(dateObj);
    },
    async getMonthCalendarByCity(city, country, dateObj, bypassCache) {
      callLog.push({ name: "getMonthCalendarByCity", city, country, bypassCache });
      return monthDays;
    },
    async getMonthCalendarByCoords(latitude, longitude, dateObj, bypassCache) {
      callLog.push({
        name: "getMonthCalendarByCoords",
        latitude,
        longitude,
        bypassCache,
      });
      return monthDays;
    },
  };
}
