// LIFECYCLE test suite — single-instance bootstrap, one subscription per
// runtime, one interval per ticker, graceful no-op guards, and destroy()
// cleanup. Source-based assertions target src/js/app/main.js and each runtime.

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  FakeElement,
  createFakeLocationService,
  DAMASCUS,
  ALEPPO,
  TZ_DAM,
  NOW_MIDDAY,
  tick,
  sleep,
  checkAsync,
  finish,
} from "../helpers/runtime.mjs";

const SRC = new URL("../../src/js/", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/");
const MAIN = `${SRC}/app/main.js`;

const mainSource = await fs.readFile(MAIN, "utf8");

const countIn = (text, needle) => text.split(needle).length - 1;

const loadUrl = (p) => import(pathToFileURL(p).href);

await checkAsync("L-01", async () => {
  // Each runtime/service factory is created exactly once at bootstrap and the
  // location service is created exactly once and shared by all runtimes.
  for (const factory of [
    "createLocationService",
    "createDailyPrayerService",
    "createQiblaService",
    "createRamadanService",
    "createWeeklyPrayerRuntime",
    "createDailyPrayerRuntime",
    "createQiblaRuntime",
    "createRamadanRuntime",
  ]) {
    assert.equal(countIn(mainSource, `${factory}(`), 1, `${factory} called once`);
  }
});

await checkAsync("L-02", async () => {
  // No runtime is constructed more than once: each create*Runtime appears
  // exactly once as a statement, and each runtime is bound to its own section
  // root element (weekly + daily + qibla + ramadan, no duplicates).
  for (const root of [
    "appWeeklyPrayerRoot",
    "appDailyPrayerRoot",
    "appQiblaRoot",
    "appRamadanRoot",
  ]) {
    assert.equal(countIn(mainSource, `rootElement: ${root}`), 1, `${root} used once`);
  }
});

await checkAsync("L-03", async () => {
  // Section render functions are each invoked once for their root.
  for (const fn of [
    "renderHeroSection",
    "renderDailyPrayerSection",
    "renderWeeklyPrayerSection",
    "renderQiblaSection",
    "renderRamadanSection",
    "renderHeaderSection",
    "renderFooterSection",
  ]) {
    assert.equal(countIn(mainSource, `${fn}(`), 1, `${fn} called once`);
  }
});

await checkAsync("L-04", async () => {
  // Each live runtime subscribes to the location service exactly once
  // (source: one `locationService.subscribe` call per runtime).
  for (const file of [
    "weekly-prayer/weekly-prayer.runtime.js",
    "daily-prayer/daily-prayer.runtime.js",
    "qibla/qibla.runtime.js",
    "ramadan/ramadan.runtime.js",
  ]) {
    const src = await fs.readFile(`${SRC}/ui/sections/${file}`, "utf8");
    assert.equal(countIn(src, ".subscribe(onLocationState)"), 1, `${file} subscribes once`);
  }
});

await checkAsync("L-05", async () => {
  // Exactly one 1-second countdown ticker per live section: Daily and Ramadan
  // own one setInterval each; Weekly owns one lightweight rollover check
  // (S5-T5) and Qibla owns none (render on demand).
  const daily = await fs.readFile(`${SRC}/ui/sections/daily-prayer/daily-prayer.runtime.js`, "utf8");
  const ramadan = await fs.readFile(`${SRC}/ui/sections/ramadan/ramadan.runtime.js`, "utf8");
  const weekly = await fs.readFile(`${SRC}/ui/sections/weekly-prayer/weekly-prayer.runtime.js`, "utf8");
  const qibla = await fs.readFile(`${SRC}/ui/sections/qibla/qibla.runtime.js`, "utf8");
  assert.equal(countIn(daily, "setInterval(tick, intervalMs)"), 1, "daily one interval");
  assert.equal(countIn(ramadan, "setInterval(tick, intervalMs)"), 1, "ramadan one interval");
  assert.equal(countIn(weekly, "setIntervalFn("), 1, "weekly one rollover timer");
  assert.equal(countIn(qibla, "setInterval("), 0, "qibla no interval");
});

await checkAsync("L-06", async () => {
  // destroy() clears the interval and unsubscribes: after destroy, a location
  // change no longer triggers a service call and the interval no longer ticks.
  const { createRamadanRuntime } = await loadUrl(`${SRC}/ui/sections/ramadan/ramadan.runtime.js`);
  const { createDailyPrayerRuntime } = await loadUrl(`${SRC}/ui/sections/daily-prayer/daily-prayer.runtime.js`);
  const { createWeeklyPrayerRuntime } = await loadUrl(`${SRC}/ui/sections/weekly-prayer/weekly-prayer.runtime.js`);
  const { createQiblaRuntime } = await loadUrl(`${SRC}/ui/sections/qibla/qibla.runtime.js`);

  const clock = { current: NOW_MIDDAY };

  function makeRamadanService() {
    const calls = [];
    return {
      calls,
      async getByLocation() {
        calls.push(1);
        return { dateKey: "2026-03-15", timezone: TZ_DAM, locationKey: "x" };
      },
    };
  }

  const root = new FakeElement();
  const loc = createFakeLocationService(DAMASCUS);
  const ramadanSvc = makeRamadanService();
  const ramadanRuntime = createRamadanRuntime({
    rootElement: root,
    locationService: loc,
    ramadanService: ramadanSvc,
    now: () => clock.current,
  });
  await tick();
  await tick();
  assert.equal(ramadanSvc.calls.length, 1);

  ramadanRuntime.destroy();
  assert.equal(loc.listenerCount, 0, "unsubscribed on destroy");
  loc.setLocation(ALEPPO);
  await sleep(30);
  await tick();
  assert.equal(ramadanSvc.calls.length, 1, "no further loads after destroy");
});

await checkAsync("L-07", async () => {
  // Missing root/location/service => graceful no-op runtime that still exposes
  // a working destroy(). All four runtimes share the guard.
  const { createRamadanRuntime } = await loadUrl(`${SRC}/ui/sections/ramadan/ramadan.runtime.js`);
  const { createDailyPrayerRuntime } = await loadUrl(`${SRC}/ui/sections/daily-prayer/daily-prayer.runtime.js`);
  const { createWeeklyPrayerRuntime } = await loadUrl(`${SRC}/ui/sections/weekly-prayer/weekly-prayer.runtime.js`);
  const { createQiblaRuntime } = await loadUrl(`${SRC}/ui/sections/qibla/qibla.runtime.js`);
  for (const factory of [
    createRamadanRuntime,
    createDailyPrayerRuntime,
    createWeeklyPrayerRuntime,
    createQiblaRuntime,
  ]) {
    const noop = factory({});
    assert.equal(typeof noop.destroy, "function");
    noop.destroy();
  }
});

await checkAsync("L-08", async () => {
  // No duplicate mounting: the runtimes attach their listeners inside their
  // own section root only, and the shared picker/tab interactions are bound
  // exactly once against document.
  assert.equal(countIn(mainSource, "bindRamadanTabsInteractions(document)"), 1);
  assert.equal(countIn(mainSource, "bindLocationPickerInteractions("), 1);
});

await checkAsync("L-09", async () => {
  // Every runtime handle is retained for cleanup: weekly, daily, qibla and
  // ramadan runtimes are each captured once and registered in the unified
  // teardown (S5-T3). The picker unbind is captured once as well.
  assert.equal(countIn(mainSource, "weeklyPrayerRuntime = createWeeklyPrayerRuntime({"), 1);
  assert.equal(countIn(mainSource, "dailyPrayerRuntime = createDailyPrayerRuntime({"), 1);
  assert.equal(countIn(mainSource, "qiblaRuntime = createQiblaRuntime({"), 1);
  assert.equal(countIn(mainSource, "ramadanRuntime = createRamadanRuntime({"), 1);
  assert.equal(countIn(mainSource, "unbindLocationPicker = bindLocationPickerInteractions("), 1);
});

await checkAsync("L-10", async () => {
  // All four runtime modules load as ES modules without a window dependency
  // (Node-safe), and their exported surface is exactly { createXxxRuntime }.
  const mods = [
    `${SRC}/ui/sections/ramadan/ramadan.runtime.js`,
    `${SRC}/ui/sections/daily-prayer/daily-prayer.runtime.js`,
    `${SRC}/ui/sections/weekly-prayer/weekly-prayer.runtime.js`,
    `${SRC}/ui/sections/qibla/qibla.runtime.js`,
  ];
  for (const mod of mods) {
    const m = await loadUrl(mod);
    assert.equal(Object.keys(m).length, 1, `${mod} exports only one binding`);
  }
});

await finish("LIFECYCLE");

