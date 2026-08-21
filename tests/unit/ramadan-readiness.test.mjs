import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import { CANONICAL_TIMINGS, makeDay } from "../fixtures/calendar.mjs";

const serviceUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname
    .replace(/^\/+([A-Za-z]):/, "$1:")
    .replaceAll("\\", "/") + "/services/ramadan.service.js",
).href;
const yearUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname
    .replace(/^\/+([A-Za-z]):/, "$1:")
    .replaceAll("\\", "/") + "/utils/ramadan-year.util.js",
).href;

const { buildRamadanContract, createRamadanService, buildLocationKey } =
  await import(serviceUrl);
const { getNextRamadanGregorianYear } = await import(yearUrl);

const results = [];
async function checkAsync(id, fn) {
  try {
    await fn();
    results.push({ id, pass: true });
    console.log(`PASS ${id} ok`);
  } catch (error) {
    results.push({ id, pass: false });
    console.log(`FAIL ${id} ${error.message}`);
  }
}

function build2026Calendars() {
  const february = [];
  for (let day = 1; day <= 28; day += 1) {
    const isRamadan = day >= 18;
    february.push(makeDay({
      year: 2026,
      month: 2,
      day,
      hijriMonth: isRamadan ? 9 : 8,
      hijriDay: isRamadan ? day - 17 : day + 12,
      hijriMonthAr: isRamadan ? "رَمَضان" : "شَعْبان",
      times: CANONICAL_TIMINGS,
    }));
  }

  const march = [];
  for (let day = 1; day <= 31; day += 1) {
    const isRamadan = day <= 19;
    march.push(makeDay({
      year: 2026,
      month: 3,
      day,
      hijriMonth: isRamadan ? 9 : 10,
      hijriDay: isRamadan ? day + 11 : day - 19,
      hijriMonthAr: isRamadan ? "رَمَضان" : "شَوَّال",
      times: CANONICAL_TIMINGS,
    }));
  }

  return new Map([
    ["2026-02", february],
    ["2026-03", march],
  ]);
}

function providersFor(calendars, calls = []) {
  const monthKey = (dateObj) =>
    `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  const dayKey = (dateObj) =>
    `${String(dateObj.getDate()).padStart(2, "0")}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${dateObj.getFullYear()}`;
  const getMonth = (dateObj) => {
    const key = monthKey(dateObj);
    const month = calendars.get(key);
    if (!month) throw new Error(`missing test month ${key}`);
    return month;
  };
  const getToday = (dateObj) => {
    const key = dayKey(dateObj);
    const day = getMonth(dateObj).find(
      (candidate) => candidate.date.gregorian.date === key,
    );
    if (!day) throw new Error(`missing test day ${key}`);
    return day;
  };
  const readMonth = async (kind, dateObj) => {
    calls.push(`${kind}:${monthKey(dateObj)}`);
    return getMonth(dateObj);
  };

  return {
    getTodayByCity: async (_city, _country, dateObj) => getToday(dateObj),
    getTodayByCoords: async (_lat, _lon, dateObj) => getToday(dateObj),
    getMonthCalendarByCity: async (_city, _country, dateObj) =>
      readMonth("city", dateObj),
    getMonthCalendarByCoords: async (_lat, _lon, dateObj) =>
      readMonth("coords", dateObj),
  };
}

const DAMASCUS = {
  type: "city",
  city: "Damascus",
  country: "Syria",
  latitude: null,
  longitude: null,
  timezone: "Asia/Damascus",
};

async function contractAt(instant, { location = DAMASCUS, calls = [] } = {}) {
  const service = createRamadanService({
    ...providersFor(build2026Calendars(), calls),
    now: () => new Date(instant),
  });
  return service.getByLocation(location);
}

await checkAsync("RD-01", async () => {
  const contract = await contractAt("2026-02-17T12:00:00+03:00");
  assert.equal(contract.dateKey, "2026-02-17");
  assert.equal(contract.isRamadan, false, "one day before Ramadan is upcoming");
  assert.equal(contract.ramadanDay, null);
});

await checkAsync("RD-02", async () => {
  const calls = [];
  const contract = await contractAt("2026-02-18T12:00:00+03:00", { calls });
  assert.equal(contract.isRamadan, true);
  assert.equal(contract.ramadanDay, 1, "first Ramadan day activates");
  assert.equal(contract.monthRows.length, 30, "full Ramadan spans both Gregorian months");
  assert.equal(contract.monthRangeLabel, "فبراير – مارس 2026");
  assert.ok(calls.includes("city:2026-03"), "next Gregorian month loaded");
  assert.equal(contract.monthRows.find((row) => row.isToday)?.ramadanDay, 1);
});

await checkAsync("RD-03", async () => {
  const calls = [];
  const contract = await contractAt("2026-03-04T12:00:00+03:00", { calls });
  assert.equal(contract.ramadanDay, 15, "middle Ramadan day maps correctly");
  assert.equal(contract.monthRows.length, 30);
  assert.ok(calls.includes("city:2026-02"), "previous Gregorian month loaded");
  assert.equal(contract.imsak, CANONICAL_TIMINGS.Imsak, "Imsak keeps provider semantics");
  assert.equal(contract.fajr, CANONICAL_TIMINGS.Fajr, "Fajr remains distinct from Imsak");
  assert.equal(contract.maghrib, CANONICAL_TIMINGS.Maghrib, "Iftar uses Maghrib");
});

await checkAsync("RD-04", async () => {
  const contract = await contractAt("2026-03-19T19:00:00+03:00");
  assert.equal(contract.ramadanDay, 30);
  assert.equal(contract.isFinalRamadanDay, true);
  assert.equal(contract.nextEvent, null, "final day never targets a Shawwal Imsak");
  assert.equal(contract.monthRows.find((row) => row.isToday)?.ramadanDay, 30);
});

await checkAsync("RD-05", async () => {
  const contract = await contractAt("2026-03-20T00:01:00+03:00");
  assert.equal(contract.isRamadan, false, "first day after Ramadan deactivates");
  assert.equal(contract.nextEvent, null);
  assert.equal(
    getNextRamadanGregorianYear({
      timeZone: contract.timezone,
      nowDate: new Date("2026-03-20T00:01:00+03:00"),
    }),
    2027,
  );
});

await checkAsync("RD-06", async () => {
  const futureDays = Array.from({ length: 30 }, (_, index) => makeDay({
    year: 2032,
    month: 4,
    day: index + 1,
    hijriMonth: 9,
    hijriDay: index + 1,
    hijriYear: 1453,
    times: CANONICAL_TIMINGS,
  }));
  const service = createRamadanService({
    ...providersFor(new Map([["2032-04", futureDays]])),
    now: () => new Date("2032-04-15T12:00:00+03:00"),
  });
  const contract = await service.getByLocation(DAMASCUS);
  assert.equal(contract.isRamadan, true, "future year needs no production edit");
  assert.equal(contract.ramadanDay, 15);
  assert.equal(contract.hijriDate.year, 1453);
});

await checkAsync("RD-07", async () => {
  const instant = "2026-02-17T22:30:00Z";
  const damascus = await contractAt(instant);
  const newYork = await contractAt(instant, {
    location: { ...DAMASCUS, city: "New York", country: "United States", timezone: "America/New_York" },
  });
  assert.equal(damascus.dateKey, "2026-02-18");
  assert.equal(damascus.isRamadan, true);
  assert.equal(newYork.dateKey, "2026-02-17");
  assert.equal(newYork.isRamadan, false, "activation follows the location-local date");
  assert.notEqual(buildLocationKey(DAMASCUS), buildLocationKey({ ...DAMASCUS, city: "New York", country: "United States", timezone: "America/New_York" }));
});

await checkAsync("RD-08", async () => {
  const dayObject = build2026Calendars().get("2026-02")[17];
  const contract = buildRamadanContract({
    dayObject,
    dateKey: "2026-02-18",
    timeZone: "Asia/Damascus",
    locationKey: buildLocationKey(DAMASCUS),
    now: new Date("2026-02-18T12:00:00+03:00"),
    monthDays: [],
  });
  assert.equal(contract.isRamadan, true);
  assert.deepEqual(contract.monthRows, [], "missing timetable remains explicit");

  const malformed = {
    ...dayObject,
    timings: { ...dayObject.timings, Imsak: null },
  };
  assert.throws(
    () => buildRamadanContract({
      dayObject: malformed,
      dateKey: "2026-02-18",
      timeZone: "Asia/Damascus",
      locationKey: buildLocationKey(DAMASCUS),
      now: new Date("2026-02-18T12:00:00+03:00"),
      monthDays: [malformed],
    }),
    /invalid time for Imsak/,
    "partial current-day data cannot masquerade as usable",
  );
});

const failed = results.filter((result) => !result.pass);
console.log(
  `RAMADAN_READINESS_SUMMARY pass=${results.length - failed.length} fail=${failed.length} total=${results.length}`,
);
if (failed.length) process.exitCode = 1;
