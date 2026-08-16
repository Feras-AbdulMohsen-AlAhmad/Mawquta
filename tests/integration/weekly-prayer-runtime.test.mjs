import test from "node:test";
import assert from "node:assert/strict";

import { createWeeklyPrayerRuntime } from "../../src/js/ui/sections/weekly-prayer/weekly-prayer.runtime.js";
import { makeWeekSlice } from "../fixtures/calendar.mjs";

const NOW = new Date("2026-03-15T12:00:00+03:00");
const LOCATION_A = {
  type: "city",
  city: "Damascus",
  country: "Syria",
  timezone: "Asia/Damascus",
};
const LOCATION_B = {
  type: "city",
  city: "Aleppo",
  country: "Syria",
  timezone: "Asia/Damascus",
};

class FakeElement {
  constructor() {
    this.innerHTML = "";
    this.textContent = "";
    this.children = new Map();
    this.listeners = new Map();
  }

  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new FakeElement());
    return this.children.get(selector);
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }
}

function createLocationService(initialLocation) {
  const listeners = new Set();
  let state = { phase: "ready", location: initialLocation };

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    setLocation(location) {
      state = { phase: "ready", location };
      for (const listener of listeners) listener(state);
    },
  };
}

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function eventTarget(selector, value, dataset = {}) {
  return {
    value,
    dataset,
    closest(value) {
      return value === selector ? this : null;
    },
  };
}

test("local weekly day selection updates content without another provider request", async () => {
  const root = new FakeElement();
  const locationService = createLocationService(LOCATION_A);
  let requests = 0;

  const runtime = createWeeklyPrayerRuntime({
    rootElement: root,
    locationService,
    now: () => NOW,
    getCurrentWeekByCity: async () => {
      requests += 1;
      return makeWeekSlice({ year: 2026, month: 3, startDay: 15 });
    },
  });
  await flush();

  const dataElement = root.querySelector("[data-weekly-data]");
  assert.match(dataElement.innerHTML, /data-selected-day-key="2026-03-15"/);

  root.listeners.get("click")({
    target: eventTarget("[data-weekly-day-option]", undefined, {
      dayKey: "2026-03-16",
    }),
  });

  assert.equal(requests, 1);
  assert.match(dataElement.innerHTML, /data-selected-day-key="2026-03-16"/);
  assert.doesNotMatch(dataElement.innerHTML, /<span class="weekly-table-mobile-pill">اليوم<\/span>/);
  runtime.destroy();
});

test("location changes reconcile the selected day against the new week", async () => {
  const root = new FakeElement();
  const locationService = createLocationService(LOCATION_A);
  const runtime = createWeeklyPrayerRuntime({
    rootElement: root,
    locationService,
    now: () => NOW,
    getCurrentWeekByCity: async (city) =>
      makeWeekSlice({ year: 2026, month: 3, startDay: city === "Damascus" ? 15 : 17 }),
  });
  await flush();

  root.listeners.get("click")({
    target: eventTarget("[data-weekly-day-option]", undefined, {
      dayKey: "2026-03-16",
    }),
  });
  locationService.setLocation(LOCATION_B);
  await flush();

  const dataElement = root.querySelector("[data-weekly-data]");
  assert.match(dataElement.innerHTML, /data-selected-day-key="2026-03-17"/);
  assert.doesNotMatch(dataElement.innerHTML, /data-selected-day-key="2026-03-16"/);
  runtime.destroy();
});

test("retry success restores today's safe selection", async () => {
  const root = new FakeElement();
  const locationService = createLocationService(LOCATION_A);
  let requests = 0;
  const runtime = createWeeklyPrayerRuntime({
    rootElement: root,
    locationService,
    now: () => NOW,
    getCurrentWeekByCity: async () => {
      requests += 1;
      if (requests === 1) throw new Error("temporary failure");
      return makeWeekSlice({ year: 2026, month: 3, startDay: 15 });
    },
  });
  await flush();

  const dataElement = root.querySelector("[data-weekly-data]");
  assert.match(dataElement.innerHTML, /weekly-prayer-error/);

  root.listeners.get("click")({
    target: { closest: () => eventTarget("[data-weekly-retry]") },
  });
  await flush();

  assert.equal(requests, 2);
  assert.match(dataElement.innerHTML, /data-selected-day-key="2026-03-15"/);
  runtime.destroy();
});

test("destroy removes delegated selector listeners", () => {
  const root = new FakeElement();
  const locationService = createLocationService(LOCATION_A);
  const runtime = createWeeklyPrayerRuntime({
    rootElement: root,
    locationService,
    now: () => NOW,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    getCurrentWeekByCity: async () => makeWeekSlice({ year: 2026, month: 3, startDay: 15 }),
  });

  assert.equal(root.listeners.has("click"), true);
  assert.equal(root.listeners.has("keydown"), true);
  assert.equal(root.listeners.has("focusout"), true);
  runtime.destroy();
  assert.equal(root.listeners.has("click"), false);
  assert.equal(root.listeners.has("keydown"), false);
  assert.equal(root.listeners.has("focusout"), false);
});
