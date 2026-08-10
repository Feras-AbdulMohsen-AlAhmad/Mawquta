// Shared Node harness helpers for the S4-T10 full-runtime integration tests.

export const TZ_DAM = "Asia/Damascus";
export const NOW_MIDDAY = new Date("2026-03-15T12:00:00+03:00");

export const DAMASCUS = {
  type: "city",
  city: "Damascus",
  country: "Syria",
  latitude: null,
  longitude: null,
  timezone: TZ_DAM,
};

export const ALEPPO = {
  type: "city",
  city: "Aleppo",
  country: "Syria",
  latitude: null,
  longitude: null,
  timezone: TZ_DAM,
};

export const COORDS_DAM = {
  type: "coords",
  city: "Damascus",
  country: "Syria",
  latitude: 33.5138,
  longitude: 36.2765,
  timezone: TZ_DAM,
};

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FakeElement {
  constructor() {
    this.textContent = "";
    this.innerHTML = "";
    this.children = new Map();
    this.listeners = new Map();
    this.attrs = new Map();
    this.style = {};
  }
  querySelector(selector) {
    if (!this.children.has(selector)) {
      this.children.set(selector, new FakeElement());
    }
    return this.children.get(selector);
  }
  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }
}

export function createFakeLocationService(initialLocation) {
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
    cancelPendingRequest() {
      state = { phase: "ready", location: state.location };
      for (const listener of [...listeners]) listener(state);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

export function tzDateKey(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const find = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}

const results = [];
export function record(id, pass, detail) {
  results.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${detail}`);
}
export async function checkAsync(id, fn) {
  try {
    await fn();
    record(id, true, "ok");
  } catch (err) {
    record(id, false, err.message);
    console.error(err.stack);
  }
}
export async function finish(prefix, exit = true) {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(
    `${prefix}_SUMMARY pass=${passed} fail=${failed.length} total=${results.length}`,
  );
  if (failed.length > 0) {
    console.error("Failed:", failed.map((r) => r.id).join(", "));
    if (exit) process.exit(1);
    return false;
  }
  if (exit) process.exit(0);
  return true;
}
