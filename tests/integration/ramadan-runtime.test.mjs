// Runtime tests for ramadan.runtime.js.
// Pure Node harness: fake DOM elements, fake location service, fake Ramadan
// service. Verifies states, sequence/race protection, retry, guards, midnight
// reload, off-season empty state, countdown transitions and destroy cleanup.

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";

const runtimeUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/ramadan.runtime.js",
).href;
const serviceUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/services/ramadan.service.js",
).href;

const { createRamadanRuntime } = await import(runtimeUrl);
const { buildRamadanContract, buildLocationKey } = await import(serviceUrl);

import {
  makeMonthCalendar,
  makeDay,
  CANONICAL_TIMINGS,
  pad2,
} from "../fixtures/calendar.mjs";

const TZ_DAM = "Asia/Damascus";
const NOW_MIDDAY = new Date("2026-03-15T12:00:00+03:00");

const results = [];
function record(id, pass, detail) {
  results.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${detail}`);
}
async function checkAsync(id, fn) {
  try {
    await fn();
    record(id, true, "ok");
  } catch (err) {
    record(id, false, err.message);
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tzDateKey(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const find = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}

function makeMonthForDateKey(dateKey, { offSeason = false } = {}) {
  const [year, month] = dateKey.split("-").map(Number);
  return makeMonthCalendar({
    year,
    month,
    hijriMonth: offSeason ? 10 : 9,
    hijriDayOffset: 11,
    hijriMonthAr: offSeason ? "شَوَّال" : "رَمَضان",
    timesFor: () => CANONICAL_TIMINGS,
  });
}

function makeContract(location, opts = {}) {
  const timeZone = location.timezone || TZ_DAM;
  const resolvedNow =
    typeof opts.now === "function" ? opts.now() : (opts.now ?? NOW_MIDDAY);
  const dateKey = opts.dateKey ?? tzDateKey(timeZone, resolvedNow);
  const [year, month, day] = dateKey.split("-").map(Number);
  const monthDays =
    opts.monthDays ?? makeMonthForDateKey(dateKey, { offSeason: opts.offSeason });
  const dayObject = monthDays.find(
    (d) => d.date.gregorian.date === `${pad2(day)}-${pad2(month)}-${year}`,
  );
  if (!dayObject) throw new Error(`no mock day for ${dateKey}`);
  return buildRamadanContract({
    dayObject,
    dateKey,
    timeZone,
    locationKey: buildLocationKey(location),
    now: resolvedNow,
    monthDays,
  });
}

class FakeElement {
  constructor() {
    this.textContent = "";
    this.innerHTML = "";
    this.children = new Map();
    this.listeners = new Map();
  }
  querySelector(selector) {
    if (!this.children.has(selector)) {
      this.children.set(selector, new FakeElement());
    }
    return this.children.get(selector);
  }
  querySelectorAll(selector) {
    if (selector !== "[data-ramadan-table-action]") return [];
    if (!this.tableActions) {
      this.tableActions = [new FakeElement(), new FakeElement()];
      this.tableActions.forEach((button) => {
        button.disabled = true;
      });
    }
    return this.tableActions;
  }
  setAttribute(name, value) {
    if (!this.attributes) this.attributes = new Map();
    this.attributes.set(name, value);
  }
  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }
}

function createFakeLocationService(initialLocation) {
  const listeners = new Set();
  let state = { phase: "ready", location: initialLocation };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    setLocation(location) {
      state = { phase: "ready", location };
      for (const listener of [...listeners]) listener(state);
    },
    setPhase(phase) {
      state = { phase, location: state.location };
      for (const listener of [...listeners]) listener(state);
    },
  };
}

function createFakeRamadanService(clock) {
  const calls = [];
  let handler = (location) => makeContract(location, { now: () => clock.current });
  let failAll = false;
  return {
    calls,
    get length() {
      return calls.length;
    },
    setHandler(fn) {
      handler = fn;
    },
    setFail(value) {
      failAll = value;
    },
    async getByLocation(location) {
      calls.push({ ...location });
      if (failAll) throw new Error("boom");
      return handler(location);
    },
  };
}

function createRuntime(root, locationService, ramadanService, clock, overrides = {}) {
  return createRamadanRuntime({
    rootElement: root,
    locationService,
    ramadanService,
    now: () => clock.current,
    intervalMs: overrides.intervalMs ?? 10000,
    ...overrides,
  });
}

const DAMASCUS = {
  type: "city",
  city: "Damascus",
  country: "Syria",
  latitude: null,
  longitude: null,
  timezone: TZ_DAM,
};
const ALEPPO = {
  type: "city",
  city: "Aleppo",
  country: "Syria",
  latitude: null,
  longitude: null,
  timezone: TZ_DAM,
};
const COORDS_DAM = {
  type: "coords",
  city: "Damascus",
  country: "Syria",
  latitude: 33.5138,
  longitude: 36.2765,
  timezone: TZ_DAM,
};

function hook(root, selector) {
  return root.querySelector(selector).textContent;
}
function dataHtml(root) {
  return root.querySelector("[data-ramadan-data]").innerHTML;
}
function tableHtml(root) {
  return root.querySelector("[data-ramadan-month-table-grid]").innerHTML;
}
function tableRowCount(root) {
  return (tableHtml(root).match(/<tr/g) || []).length - 1; // minus header
}

await checkAsync("RR-01", async () => {
  // Default Damascus in Ramadan: loading -> success, city label, month, day,
  // imsak/iftar, countdown and the month table from real calendar data.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);

  assert.ok(dataHtml(root).includes("ramadan-prayer-loading"), "loading shown synchronously");

  await tick();
  await tick();

  assert.equal(ramadan.length, 1);
  assert.equal(ramadan.calls[0].city, "Damascus");
  assert.equal(hook(root, "[data-ramadan-city]"), "دمشق، سوريا");
  assert.equal(hook(root, "[data-ramadan-month]"), "رمضان 2026");
  assert.equal(hook(root, "[data-ramadan-day]"), "26");
  assert.equal(hook(root, "[data-ramadan-day-label]"), "اليوم");
  assert.equal(hook(root, "[data-ramadan-imsak]"), "05:28");
  assert.equal(hook(root, "[data-ramadan-iftar]"), "18:43");
  assert.equal(hook(root, "[data-ramadan-countdown-title]"), "الوقت المتبقي للإفطار");
  assert.equal(hook(root, "[data-ramadan-countdown-hours]"), "06");
  assert.equal(hook(root, "[data-ramadan-countdown-minutes]"), "43");
  assert.equal(hook(root, "[data-ramadan-countdown-seconds]"), "00");
  assert.equal(dataHtml(root), "", "no status region once success");
  assert.ok(tableHtml(root).includes("data-rt-city"), "table grid rendered");
  assert.ok(tableHtml(root).includes("دمشق، سوريا"), "table location label");
  assert.ok(tableHtml(root).includes("مارس 2026"), "table range label");
  assert.equal(tableRowCount(root), 7, "compact seven-day window rendered initially");
  assert.ok(tableHtml(root).includes('class="table-row--today"'), "current day remains in the compact window");
  root.listeners.get("click")({
    target: { closest: (selector) => (selector === "[data-rt-load-more]" ? {} : null) },
  });
  assert.equal(tableRowCount(root), 19, "all usable fixture rows revealed on request");
  assert.ok(root.tableActions.every((button) => button.disabled), "placeholder export actions remain disabled");
  assert.ok(tableHtml(root).includes("aria-label=\"جدول رمضان\""), "table aria label");
  assert.ok(tableHtml(root).includes("weekly-table-mobile-card"), "mobile list rendered");
  assert.equal(hook(root, "[data-rt-head-hijri]"), "1447", "head hijri year from contract");
  assert.equal(hook(root, "[data-rt-head-gregorian]"), "مارس 2026", "head gregorian range from contract");
  runtime.destroy();
});

await checkAsync("RR-02", async () => {
  // Coords location: coords passed to the service.
  const root = new FakeElement();
  const location = createFakeLocationService(COORDS_DAM);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);

  await tick();
  await tick();

  assert.equal(ramadan.length, 1);
  assert.equal(ramadan.calls[0].type, "coords");
  assert.equal(ramadan.calls[0].latitude, 33.5138);
  assert.equal(ramadan.calls[0].longitude, 36.2765);
  assert.equal(hook(root, "[data-ramadan-imsak]"), "05:28");
  runtime.destroy();
});

await checkAsync("RR-03", async () => {
  // Location change clears previous-location data: during the new load only
  // the loading state is shown (no old table), then new data renders.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);

  let resolveSecond;
  const second = new Promise((resolve) => {
    resolveSecond = resolve;
  });
  let callIndex = 0;
  ramadan.setHandler((loc) => {
    if (callIndex++ === 0) return makeContract(loc, { now: () => clock.current });
    return second.then(() => makeContract(loc, { now: () => clock.current }));
  });

  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();
  assert.ok(tableHtml(root).includes("data-rt-city"));

  location.setLocation(ALEPPO);
  await tick();
  await tick();

  assert.ok(dataHtml(root).includes("ramadan-prayer-loading"), "no previous-location data while loading");
  assert.ok(tableHtml(root).includes("ramadan-timetable-skeleton"), "loading state replaces previous-location table");
  assert.equal(hook(root, "[data-ramadan-imsak]"), "--:--");

  resolveSecond(makeContract(ALEPPO, { now: () => clock.current }));
  await tick();
  await tick();

  assert.equal(hook(root, "[data-ramadan-city]"), "Aleppo، Syria");
  assert.ok(tableHtml(root).includes("data-rt-city"));
  runtime.destroy();
});

await checkAsync("RR-04", async () => {
  // Rapid changes: only the newest request wins.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);

  const resolvers = new Map();
  let idx = 0;
  ramadan.setHandler((loc) => {
    const deferred = new Promise((resolve) => resolvers.set(++idx, resolve));
    deferred.location = loc;
    return deferred;
  });

  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();
  assert.equal(ramadan.length, 1);

  location.setLocation(ALEPPO); // request 2
  location.setLocation(COORDS_DAM); // request 3 (newest)
  await tick();
  await tick();

  resolvers.get(3)(makeContract(COORDS_DAM, { now: () => clock.current }));
  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-imsak]"), "05:28", "newest rendered");

  // Older request resolves later and must be discarded.
  resolvers.get(2)(
    makeContract(ALEPPO, {
      now: () => clock.current,
      monthDays: makeMonthForDateKey("2026-03-15").map((d) =>
        d.date.gregorian.date === "15-03-2026"
          ? { ...d, timings: { ...d.timings, Maghrib: "18:01" } }
          : d,
      ),
    }),
  );
  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-iftar]"), "18:43", "stale result not applied");
  runtime.destroy();
});

await checkAsync("RR-05", async () => {
  // Stale response discarded: two requests, older resolves last, ignored.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);

  let resolveFirst;
  let resolveSecond;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const second = new Promise((resolve) => { resolveSecond = resolve; });
  let callIndex = 0;
  ramadan.setHandler((loc) => (callIndex++ === 0 ? first : second));

  createRuntime(root, location, ramadan, clock);
  await tick();

  location.setLocation(ALEPPO);
  await tick();
  await tick();

  resolveSecond(
    makeContract(ALEPPO, {
      now: () => clock.current,
      monthDays: makeMonthForDateKey("2026-03-15").map((d) =>
        d.date.gregorian.date === "15-03-2026"
          ? { ...d, timings: { ...d.timings, Imsak: "04:01" } }
          : d,
      ),
    }),
  );
  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-imsak]"), "04:01", "newer data rendered");

  resolveFirst(makeContract(DAMASCUS, { now: () => clock.current }));
  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-imsak]"), "04:01", "stale result ignored");
});

await checkAsync("RR-06", async () => {
  // Same location/day request guard: no duplicate fetch for the same key.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);

  await tick();
  await tick();
  assert.equal(ramadan.length, 1);

  // Loading + ready re-emission for the same location must not refetch.
  location.setPhase("loading");
  location.setPhase("ready");
  await tick();

  assert.equal(ramadan.length, 1, "no duplicate fetch for same location/day");
  runtime.destroy();
});

await checkAsync("RR-07", async () => {
  // Error with no data: Arabic message + retry button; retry recovers.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  ramadan.setFail(true);

  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();

  assert.ok(dataHtml(root).includes("تعذر تحميل"), "error message rendered");
  assert.ok(dataHtml(root).includes("data-ramadan-retry"), "retry button rendered");
  assert.equal(hook(root, "[data-ramadan-imsak]"), "--:--", "no stale times on first error");
  assert.ok(tableHtml(root).includes("تعذر تحميل إمساكية رمضان"), "table error state shown");

  ramadan.setFail(false);
  root.listeners.get("click")({
    target: { closest: (selector) => (selector === "[data-ramadan-retry]" ? {} : null) },
  });
  await tick();
  await tick();

  assert.equal(hook(root, "[data-ramadan-imsak]"), "05:28", "retry recovered to success");
  assert.ok(tableHtml(root).includes("data-rt-city"));
  runtime.destroy();
});

await checkAsync("RR-08", async () => {
  // Off-season: clean empty state — placeholders everywhere, no table, Arabic
  // off-season message in the status region.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  ramadan.setHandler((loc) =>
    makeContract(loc, { now: () => clock.current, offSeason: true }),
  );

  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();

  assert.equal(ramadan.length, 1);
  assert.equal(hook(root, "[data-ramadan-month]"), "—");
  assert.equal(hook(root, "[data-ramadan-day]"), "—");
  assert.equal(hook(root, "[data-ramadan-imsak]"), "--:--");
  assert.equal(hook(root, "[data-ramadan-iftar]"), "--:--");
  assert.equal(hook(root, "[data-ramadan-countdown-hours]"), "--");
  assert.equal(hook(root, "[data-ramadan-countdown-title]"), "—");
  assert.ok(tableHtml(root).includes("لا توجد إمساكية رمضان متاحة حاليًا"), "refined no-data state off-season");
  assert.ok(tableHtml(root).includes("ستتوفر المواقيت عند بدء شهر رمضان القادم في عام 2027."), "upcoming year in no-data state");
  assert.ok(tableHtml(root).includes("ramadan-timetable-state__illustration"), "Ramadan empty-state illustration");
  assert.ok(dataHtml(root).includes("لا توجد إمساكية متاحة حاليًا."), "refined off-season status");
  assert.ok(dataHtml(root).includes("عند بدء رمضان القادم في عام 2027."), "upcoming year in status");
  runtime.destroy();
});

await checkAsync("RR-09", async () => {
  // Countdown ticks and transitions after Maghrib -> next-day Imsak offline.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: new Date("2026-03-15T18:42:55+03:00") };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock, { intervalMs: 20 });

  await tick();
  await tick();
  assert.equal(ramadan.length, 1);
  assert.equal(hook(root, "[data-ramadan-countdown-title]"), "الوقت المتبقي للإفطار");
  assert.equal(hook(root, "[data-ramadan-countdown-seconds]"), "05");

  clock.current = new Date("2026-03-15T18:42:57+03:00");
  await sleep(50);
  assert.equal(hook(root, "[data-ramadan-countdown-seconds]"), "03");

  clock.current = new Date("2026-03-15T18:43:01+03:00");
  await sleep(50);
  await tick();
  assert.equal(hook(root, "[data-ramadan-countdown-title]"), "الوقت المتبقي للإمساك", "transition after iftar");
  assert.equal(ramadan.length, 1, "no network on transition");
  runtime.destroy();
});

await checkAsync("RR-10", async () => {
  // After Maghrib the countdown targets the next-day Imsak.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: new Date("2026-03-15T19:00:00+03:00") };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);

  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-countdown-title]"), "الوقت المتبقي للإمساك");
  const hours = Number(hook(root, "[data-ramadan-countdown-hours]"));
  const minutes = Number(hook(root, "[data-ramadan-countdown-minutes]"));
  // 19:00 -> 05:28 next day => 10h28m
  assert.equal(hours, 10);
  assert.equal(minutes, 28);
  runtime.destroy();
});

await checkAsync("RR-11", async () => {
  // Midnight rollover: changing dateKey in the location timezone triggers an
  // automatic reload without a manual refresh.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: new Date("2026-03-15T23:59:59+03:00") };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock, { intervalMs: 20 });

  await tick();
  await tick();
  assert.equal(ramadan.length, 1);
  assert.equal(hook(root, "[data-ramadan-day]"), "26");

  clock.current = new Date("2026-03-16T00:00:01+03:00");
  await sleep(80);
  await tick();
  await tick();

  assert.equal(ramadan.length, 2, "automatic reload after midnight");
  assert.equal(hook(root, "[data-ramadan-day]"), "27", "new day rendered");
  runtime.destroy();
});

await checkAsync("RR-12", async () => {
  // destroy() stops subscription and interval: no further loads.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);

  await tick();
  await tick();
  assert.equal(ramadan.length, 1);

  runtime.destroy();
  location.setLocation(ALEPPO);
  await sleep(40);
  await tick();

  assert.equal(ramadan.length, 1, "no fetch after destroy/unsubscribe");
});

await checkAsync("RR-13", async () => {
  // No geolocation / navigator usage in the runtime source (code lines only,
  // comments may mention the constraint).
  const source = await fs.readFile(
    new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/ramadan.runtime.js",
    "utf8",
  );
  const codeLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"));
  for (const line of codeLines) {
    assert.ok(
      !line.includes("navigator") && !line.includes("geolocation"),
      `no geolocation/navigator: ${line}`,
    );
  }

  // A full load still succeeds without any window/geolocation.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-imsak]"), "05:28");
  runtime.destroy();
});

await checkAsync("RR-14", async () => {
  // No Qibla/Hero/Daily coupling: the runtime only ever invokes the injected
  // Ramadan service with plain location arguments and exposes only destroy().
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);

  await tick();
  await tick();
  location.setLocation(ALEPPO);
  await tick();
  await tick();

  assert.equal(ramadan.length, 2);
  for (const call of ramadan.calls) {
    assert.equal(typeof call, "object");
    assert.equal("city" in call, true, "plain location passed");
  }
  assert.deepEqual(Object.keys(runtime).sort(), ["destroy"]);
  runtime.destroy();
});

await checkAsync("RR-15", async () => {
  // Missing root/service: graceful no-op runtime.
  const noop = createRamadanRuntime({});
  assert.equal(typeof noop.destroy, "function");
  noop.destroy();
});

await checkAsync("RR-16", async () => {
  // Active Ramadan with no usable month rows is distinct from the upcoming
  // state and never enables placeholder export actions.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  ramadan.setHandler((loc) => ({
    ...makeContract(loc, { now: () => clock.current }),
    monthRows: [],
  }));

  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();

  assert.ok(tableHtml(root).includes("لا تتوفر بيانات الإمساكية لهذا الشهر"));
  assert.ok(!tableHtml(root).includes("رمضان القادم"), "not presented as upcoming Ramadan");
  assert.ok(root.tableActions.every((button) => button.disabled));
  runtime.destroy();
});

await checkAsync("RR-17", async () => {
  // A failed same-day refresh must replace the previous contract rather than
  // presenting stale times/table rows as current.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();
  assert.equal(hook(root, "[data-ramadan-imsak]"), "05:28");

  ramadan.setFail(true);
  root.listeners.get("click")({
    target: { closest: (selector) => (selector === "[data-ramadan-retry]" ? {} : null) },
  });
  await tick();
  await tick();

  assert.equal(hook(root, "[data-ramadan-imsak]"), "--:--", "stale time cleared");
  assert.ok(tableHtml(root).includes("تعذر تحميل إمساكية رمضان"), "error replaces stale table");
  runtime.destroy();
});

await checkAsync("RR-18", async () => {
  // Timezone metadata is part of the Ramadan freshness context even when the
  // city and resulting local date key remain the same.
  const root = new FakeElement();
  const location = createFakeLocationService(DAMASCUS);
  const clock = { current: NOW_MIDDAY };
  const ramadan = createFakeRamadanService(clock);
  const runtime = createRuntime(root, location, ramadan, clock);
  await tick();
  await tick();
  assert.equal(ramadan.length, 1);

  location.setLocation({ ...DAMASCUS, timezone: "Europe/London" });
  await tick();
  await tick();

  assert.equal(ramadan.length, 2, "same city reloads after timezone change");
  runtime.destroy();
});

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(
  `RUNTIME_SUMMARY pass=${passed} fail=${failed.length} total=${results.length}`,
);
if (failed.length > 0) {
  console.error("Failed:", failed.map((r) => r.id).join(", "));
  process.exit(1);
} else {
  process.exit(0);
}
