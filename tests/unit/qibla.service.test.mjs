// Qibla service tests (S4-T8).
// Pure Node harness: imports qibla.service.js, injects a fake geocode lookup.

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";

const servicePath = new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/services/qibla.service.js";
const serviceUrl = pathToFileURL(servicePath).href;
const { createQiblaService, isDefaultDamascus } = await import(serviceUrl);

const TOL = 0.2;

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

const DAMASCUS_DEFAULT = {
  type: "city", city: "Damascus", country: "Syria",
  latitude: null, longitude: null, timezone: "Asia/Damascus",
};
const DAMASCUS_WITH_COORDS = {
  type: "city", city: "Damascus", country: "Syria",
  latitude: 33.5138, longitude: 36.2765, timezone: "Asia/Damascus",
};
const COORDS_LOCATION = {
  type: "coords", city: "Damascus", country: "Syria",
  latitude: 33.5138, longitude: 36.2765, timezone: "Asia/Damascus",
};
const HOMS_NO_COORDS = {
  type: "city", city: "Homs", country: "Syria",
  latitude: null, longitude: null, timezone: "Asia/Damascus",
};
const ALEPPO_NO_COORDS = {
  type: "city", city: "Aleppo", country: "Syria",
  latitude: null, longitude: null, timezone: "Asia/Damascus",
};

function fakeLookup(store = {}) {
  store.calls = [];
  return async function geocodeCity(city, country) {
    store.calls.push({ city, country });
    if (store.fail) throw new Error("geocode boom");
    if (store.malformed) return {};
    if (city === "Homs") return { latitude: 34.7324, longitude: 36.7137 };
    if (city === "Aleppo") return { latitude: 36.2021, longitude: 37.1343 };
    return { latitude: 33.5138, longitude: 36.2765 };
  };
}

const FIXED_NOW = () => new Date("2026-08-05T10:00:00.000Z");

await checkAsync("QS-01", async () => {
  const store = {};
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  const contract = await service.getByLocation(DAMASCUS_DEFAULT);
  assert.ok(Math.abs(contract.qiblaBearing - 164.5) <= TOL, `bearing=${contract.qiblaBearing}`);
  assert.equal(contract.latitude, 33.5138);
  assert.equal(contract.longitude, 36.2765);
  assert.equal(store.calls.length, 0, "no geocode for default Damascus");
  assert.equal(contract.source, "local-calculation");
  assert.equal(contract.cityName, "دمشق، سوريا");
});

await checkAsync("QS-02", async () => {
  const store = {};
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  const contract = await service.getByLocation(DAMASCUS_WITH_COORDS);
  assert.ok(Math.abs(contract.qiblaBearing - 164.5) <= TOL);
  assert.equal(store.calls.length, 0, "no geocode for city with coords");
});

await checkAsync("QS-03", async () => {
  const store = {};
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  const contract = await service.getByLocation(COORDS_LOCATION);
  assert.ok(Math.abs(contract.qiblaBearing - 164.5) <= TOL);
  assert.equal(contract.locationKey, "coords:33.5138,36.2765");
  assert.equal(store.calls.length, 0, "no geocode for coords location");
});

await checkAsync("QS-04", async () => {
  const store = {};
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  const contract = await service.getByLocation(HOMS_NO_COORDS);
  assert.equal(store.calls.length, 1, "one lookup for coordinate-less city");
  assert.deepEqual(store.calls[0], { city: "Homs", country: "Syria" });
  assert.ok(Math.abs(contract.qiblaBearing - 167.6) <= TOL, `bearing=${contract.qiblaBearing}`);
  assert.equal(contract.latitude, 34.7324);
});

await checkAsync("QS-05", async () => {
  const store = { fail: true };
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  await assert.rejects(() => service.getByLocation(HOMS_NO_COORDS), /geocode boom/);
});

await checkAsync("QS-06", async () => {
  const store = { malformed: true };
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  await assert.rejects(
    () => service.getByLocation(HOMS_NO_COORDS),
    /invalid coordinates/,
  );
});

await checkAsync("QS-07", async () => {
  const store = {};
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  const [a, b] = await Promise.all([
    service.getByLocation(HOMS_NO_COORDS),
    service.getByLocation(HOMS_NO_COORDS),
  ]);
  assert.equal(a.locationKey, b.locationKey);
  assert.equal(store.calls.length, 1, "in-flight dedupe: one lookup");
  await service.getByLocation(HOMS_NO_COORDS);
  assert.equal(store.calls.length, 1, "same-city session dedupe: still one lookup");
});

await checkAsync("QS-08", async () => {
  const source = await fs.readFile(servicePath, "utf8");
  assert.ok(!source.includes("aladhan.api"), "service must not import aladhan.api");
  assert.ok(!source.includes("getQiblaDirectionByCoords"));
  assert.ok(!source.includes("window.axios"));
  assert.ok(!source.includes("navigator"));
  assert.ok(source.includes("local-calculation"), "source tag present");
});

await checkAsync("QS-09", async () => {
  // Distinct coordinate-less cities in one session: one lookup each, never more.
  const store = {};
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  await service.getByLocation(HOMS_NO_COORDS);
  await service.getByLocation(ALEPPO_NO_COORDS);
  await service.getByLocation(HOMS_NO_COORDS);
  await service.getByLocation(ALEPPO_NO_COORDS);
  assert.equal(store.calls.length, 2, "one lookup per city");
});

await checkAsync("QS-10", async () => {
  // Failed lookup clears the cache: retry re-runs the lookup.
  const store = { fail: true };
  const service = createQiblaService({ geocodeCity: fakeLookup(store), now: FIXED_NOW });
  await assert.rejects(() => service.getByLocation(HOMS_NO_COORDS));
  assert.equal(store.calls.length, 1);
  store.fail = false;
  const contract = await service.getByLocation(HOMS_NO_COORDS);
  assert.ok(Number.isFinite(contract.qiblaBearing));
  assert.equal(store.calls.length, 2, "retry re-looked-up after failure");
});

await checkAsync("QS-11", async () => {
  // Missing geocodeCity injection: default throws a clear error, not a crash.
  const service = createQiblaService({ now: FIXED_NOW });
  await assert.rejects(() => service.getByLocation(HOMS_NO_COORDS), /no coordinate lookup/);
});

await checkAsync("QS-12", () => {
  assert.equal(isDefaultDamascus(DAMASCUS_DEFAULT), true);
  assert.equal(isDefaultDamascus(DAMASCUS_WITH_COORDS), true);
  assert.equal(isDefaultDamascus(HOMS_NO_COORDS), false);
});

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`QIBLA_SERVICE_SUMMARY pass=${passed} fail=${failed.length} total=${results.length}`);
if (failed.length > 0) {
  console.error("Failed:", failed.map((r) => r.id).join(", "));
  process.exit(1);
} else {
  process.exit(0);
}
