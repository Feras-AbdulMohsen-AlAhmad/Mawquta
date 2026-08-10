import { abs } from "../helpers/storage.mjs";
import {
  makeGeoMock,
  setGeolocationUnsupported,
  setGeolocationNonFunction,
  installAxiosMock,
  makePickerHarness,
  deferred,
  fire,
} from "../helpers/geolocation.mjs";
import {
  FakeStorage,
} from "../helpers/storage.mjs";
import {
  createFetchMock,
  okResponse,
  createTimerMock,
  flush,
} from "../helpers/dom-fetch.mjs";

globalThis.window = { location: { origin: "http://localhost" } };
const axiosMock = installAxiosMock();

const {
  createLocationService,
  normalizeLocation,
} = await import(abs("services/location.service.js"));
const { bindLocationPickerInteractions } = await import(
  abs("ui/sections/qibla/interactions/location-picker.interactions.js")
);

const STORAGE_KEY = "ms_location";
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
    record(id, false, String(err.message || err));
  }
}

function makeWindow() {
  return {
    location: { origin: "http://localhost" },
  };
}

function setup({ axiosCity } = {}) {
  axiosMock.city = axiosCity ?? "Damascus";
  axiosMock.countryName = "Syria";
  axiosMock.timezone = "Asia/Damascus";
  axiosMock.fail = false;
  const win = makeWindow();
  globalThis.window = win;
  const storage = new FakeStorage();
  const locationService = createLocationService({ storage });
  locationService.initialize();
  const h = makePickerHarness();
  const unbind = bindLocationPickerInteractions(h.doc, locationService);
  const geo = makeGeoMock();
  geo.install();
  return { locationService, storage, unbind, geo, ...h };
}

const geoErrorStatus = /تعذر اعتماد موقع المتصفح/;
const pendingStatus = /بانتظار إذن الموقع/;
const reviewStatus = /راجع الموقع المقترح/;
const confirmedStatus = /تم اعتماد الموقع/;

// ---------- GL-01 no geolocation call on bootstrap ----------
{
  const geo = makeGeoMock();
  geo.install();
  const win = makeWindow();
  globalThis.window = win;
  const locationService = createLocationService({ storage: new FakeStorage() });
  locationService.initialize();
  const h = makePickerHarness();
  const unbind = bindLocationPickerInteractions(h.doc, locationService);
  await checkAsync("GL-01 no geolocation on bootstrap", async () => {
    if (geo.calls.length !== 0) throw new Error(`geolocation called ${geo.calls.length} times`);
    if (geo.watchCalls !== 0) throw new Error("watchPosition used");
  });
  unbind();
}

// ---------- GL-02 explicit user action invokes geolocation once ----------
{
  const ctx = setup();
  await checkAsync("GL-02 user action invokes once + button disabled", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    if (ctx.geo.calls.length !== 1) throw new Error(`expected 1 call, got ${ctx.geo.calls.length}`);
    if (!ctx.geoBtn.disabled) throw new Error("button must be disabled while pending");
    if (!pendingStatus.test(ctx.status.textContent)) {
      throw new Error(`expected pending status, got "${ctx.status.textContent}"`);
    }
  });
}

// ---------- GL-03 unsupported geolocation ----------
{
  setGeolocationUnsupported();
  const win = makeWindow();
  globalThis.window = win;
  const locationService = createLocationService({ storage: new FakeStorage() });
  locationService.initialize();
  const h = makePickerHarness();
  const unbind = bindLocationPickerInteractions(h.doc, locationService);
  await checkAsync("GL-03 unsupported -> recoverable status, no crash", async () => {
    fire(h.geoBtn, "click");
    await flush();
    if (!geoErrorStatus.test(h.status.textContent)) {
      throw new Error(`expected recoverable error, got "${h.status.textContent}"`);
    }
    if (h.geoBtn.disabled) throw new Error("button must be re-enabled");
    if (locationService.getState().location.city !== "Damascus") throw new Error("location unchanged");
  });
  unbind();
}

// ---------- GL-03b getCurrentPosition non-function ----------
{
  setGeolocationNonFunction();
  const win = makeWindow();
  globalThis.window = win;
  const locationService = createLocationService({ storage: new FakeStorage() });
  locationService.initialize();
  const h = makePickerHarness();
  const unbind = bindLocationPickerInteractions(h.doc, locationService);
  await checkAsync("GL-03b non-function getCurrentPosition -> recoverable", async () => {
    fire(h.geoBtn, "click");
    await flush();
    if (!geoErrorStatus.test(h.status.textContent)) throw new Error("recoverable status expected");
    if (h.geoBtn.disabled) throw new Error("button re-enabled");
  });
  unbind();
}

// ---------- GL-04..GL-07 geolocation error codes ----------
for (const [tag, code] of [
  ["permission denied", 1],
  ["position unavailable", 2],
  ["timeout", 3],
  ["unknown code", 99],
]) {
  const ctx = setup();
  await checkAsync(`GL-04/05/06/07 ${tag} -> recoverable status`, async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].error({ code, message: "stub" });
    await flush();
    if (!geoErrorStatus.test(ctx.status.textContent)) {
      throw new Error(`expected recoverable error for code ${code}, got "${ctx.status.textContent}"`);
    }
    if (ctx.geoBtn.disabled) throw new Error("button must be re-enabled");
    if (ctx.locationService.getState().location.city !== "Damascus") {
      throw new Error("location must not change on failure");
    }
    if (/undefined|Error:|stub/.test(ctx.status.textContent)) {
      throw new Error("internal error details leaked to UI");
    }
  });
}

// malformed error callback (non-Error)
{
  const ctx = setup();
  await checkAsync("GL-07b malformed error callback -> safe generic status", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].error("plain string rejection");
    await flush();
    if (!geoErrorStatus.test(ctx.status.textContent)) throw new Error("generic status expected");
    if (ctx.locationService.getState().location.city !== "Damascus") throw new Error("location unchanged");
  });
}

// ---------- GL-08 valid coordinates accepted ----------
{
  const ctx = setup();
  await checkAsync("GL-08 valid coords accepted + candidate presented", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();
    if (ctx.candidate.hidden) throw new Error("candidate must be presented");
    if (!/الموقع المقترح/.test(ctx.candidate.textContent)) throw new Error("candidate text");
    if (!reviewStatus.test(ctx.status.textContent)) throw new Error("review status expected");
    if (ctx.confirmBtn.disabled) throw new Error("confirm enabled");
    if (ctx.geoBtn.disabled) throw new Error("button re-enabled after success");
  });
}

// ---------- GL-09..GL-11 invalid/malformed coordinates ----------
for (const [tag, coords] of [
  ["out-of-range latitude", { latitude: 100, longitude: 36 }],
  ["out-of-range longitude", { latitude: 33, longitude: 200 }],
  ["NaN latitude", { latitude: NaN, longitude: 36 }],
  ["Infinity longitude", { latitude: 33, longitude: Infinity }],
  ["missing coords", {}],
  ["missing latitude", { longitude: 36 }],
  ["numeric strings", { latitude: "33", longitude: "36" }],
]) {
  const ctx = setup();
  await checkAsync(`GL-09/10/11 ${tag} rejected safely`, async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].success({ coords });
    await flush();
    if (!geoErrorStatus.test(ctx.status.textContent)) {
      throw new Error(`expected recoverable rejection, got "${ctx.status.textContent}"`);
    }
    if (ctx.locationService.getState().location.city !== "Damascus") {
      throw new Error("location must not change");
    }
    if (!ctx.candidate.hidden) throw new Error("no candidate on invalid coords");
    if (ctx.confirmBtn.disabled === false) throw new Error("confirm must stay disabled");
  });
}

// ---------- GL-12 rapid repeated click ----------
{
  const ctx = setup();
  await checkAsync("GL-12 rapid repeated click does not conflict", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    if (ctx.geoBtn.disabled) {
      // A disabled button cannot be re-clicked in the real DOM.
      // (skip firing a second click)
    } else {
      fire(ctx.geoBtn, "click");
      await flush();
    }
    if (ctx.geo.calls.length !== 1) throw new Error(`expected 1 call, got ${ctx.geo.calls.length}`);
    // resolve first request, state consistent
    ctx.geo.calls[0].success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();
    if (ctx.candidate.hidden) throw new Error("single candidate expected");
  });
}

// ---------- GL-13 stale old success cannot overwrite newer manual selection ----------
{
  const ctx = setup();
  const fetchMock = createFetchMock();
  fetchMock.install();
  const timer = createTimerMock();
  await checkAsync("GL-13 stale old success cannot overwrite manual selection", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    const geoCall = ctx.geo.calls[0];

    // user types a manual search while geolocation pending
    ctx.input.value = "Homs";
    fire(ctx.input, "input");
    timer.runAll();
    await flush();
    fetchMock.calls[0].resolve(
      okResponse([
        { city: "Homs", country: "Syria", lat: 34.7308, lon: 36.7094, timezone: "Asia/Damascus" },
      ]),
    );
    await flush();
    const option = ctx.results.children[0];
    if (!option) throw new Error("search result expected");
    fire(option, "click");
    await flush();
    const manualCandidate = ctx.candidate.textContent;
    if (!/Homs/.test(manualCandidate)) throw new Error(`manual candidate expected, got "${manualCandidate}"`);

    // old geolocation resolves late
    geoCall.success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();

    if (!/Homs/.test(ctx.candidate.textContent)) {
      throw new Error("stale geolocation overwrote manual selection");
    }
    if (ctx.locationService.getState().location.city !== "Damascus") {
      throw new Error("no accept yet, location unchanged");
    }
  });
  timer.restore();
  fetchMock.restore();
}

// ---------- GL-14 stale old error cannot overwrite newer success/selection ----------
{
  const ctx = setup();
  const fetchMock = createFetchMock();
  fetchMock.install();
  const timer = createTimerMock();
  await checkAsync("GL-14 stale old error cannot clobber newer manual state", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    const geoCall = ctx.geo.calls[0];

    ctx.input.value = "Homs";
    fire(ctx.input, "input");
    timer.runAll();
    await flush();
    fetchMock.calls[0].resolve(
      okResponse([
        { city: "Homs", country: "Syria", lat: 34.7308, lon: 36.7094, timezone: "Asia/Damascus" },
      ]),
    );
    await flush();
    fire(ctx.results.children[0], "click");
    await flush();
    const before = ctx.status.textContent;

    // old geolocation fails late
    geoCall.error({ code: 1, message: "denied" });
    await flush();

    if (geoErrorStatus.test(ctx.status.textContent)) {
      throw new Error("stale error clobbered newer manual state");
    }
    if (!/Homs/.test(ctx.candidate.textContent)) {
      throw new Error("candidate must stay the manual selection");
    }
  });
  timer.restore();
  fetchMock.restore();
}

// ---------- GL-15 manual search works after geolocation failure ----------
{
  const ctx = setup();
  const fetchMock = createFetchMock();
  fetchMock.install();
  const timer = createTimerMock();
  await checkAsync("GL-15 manual search usable after geolocation failure", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].error({ code: 2, message: "unavailable" });
    await flush();
    if (!geoErrorStatus.test(ctx.status.textContent)) throw new Error("error status first");

    ctx.input.value = "Aleppo";
    fire(ctx.input, "input");
    timer.runAll();
    await flush();
    fetchMock.calls[0].resolve(
      okResponse([
        { city: "Aleppo", country: "Syria", lat: 36.202, lon: 37.134, timezone: "Asia/Damascus" },
      ]),
    );
    await flush();
    if (ctx.results.children.length === 0) throw new Error("search results must render");
    fire(ctx.results.children[0], "click");
    await flush();
    if (!/Aleppo/.test(ctx.candidate.textContent)) throw new Error("manual selection works after failure");
  });
  timer.restore();
  fetchMock.restore();
}

// ---------- GL-16 successful geolocation propagates exactly once ----------
{
  const ctx = setup({ axiosCity: "Latakia" });
  let latakiaCount = 0;
  ctx.locationService.subscribe((st) => {
    if (st.location && st.location.city === "Latakia") latakiaCount += 1;
  });
  await checkAsync("GL-16 successful geolocation propagates exactly once", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].success({ coords: { latitude: 35.5317, longitude: 35.7901 } });
    await flush();
    fire(ctx.confirmBtn, "click");
    await flush();
    const state = ctx.locationService.getState();
    if (state.location.city !== "Latakia") throw new Error(`expected Latakia, got ${state.location.city}`);
    if (state.phase !== "ready") throw new Error("phase ready");
    if (latakiaCount !== 1) {
      throw new Error(`expected exactly 1 final-location notification, got ${latakiaCount}`);
    }
  });
}

// ---------- GL-17 successful location persistable/restorable ----------
{
  const ctx = setup();
  await checkAsync("GL-17 successful geolocation persists + restores", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].success({ coords: { latitude: 35.5317, longitude: 35.7901 } });
    await flush();
    fire(ctx.confirmBtn, "click");
    await flush();
    const persisted = JSON.parse(ctx.storage.store.get(STORAGE_KEY));
    if (persisted.type !== "coords") throw new Error(`type coords expected, got ${persisted.type}`);
    if (persisted.latitude !== 35.5317) throw new Error("lat persisted");

    const s2 = createLocationService({ storage: ctx.storage });
    const restored = s2.initialize().location;
    if (restored.latitude !== 35.5317) throw new Error("coords restored");
    if (restored.source !== "stored") throw new Error("source stored");
  });
}

// ---------- GL-18 no watchPosition / continuous tracking ----------
{
  const geo = makeGeoMock();
  geo.install();
  const win = makeWindow();
  globalThis.window = win;
  const locationService = createLocationService({ storage: new FakeStorage() });
  locationService.initialize();
  const h = makePickerHarness();
  const unbind = bindLocationPickerInteractions(h.doc, locationService);
  await checkAsync("GL-18 no watchPosition/continuous tracking", async () => {
    fire(h.geoBtn, "click");
    await flush();
    if (geo.watchCalls !== 0) throw new Error("watchPosition must not be used");
    if (geo.calls.length !== 1) throw new Error("exactly one getCurrentPosition");
  });
  unbind();
}

// ---------- GL-19 accessibility/loading recovers after every outcome ----------
{
  const ctx = setup();
  await checkAsync("GL-19 loading recovers after success", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    if (!ctx.geoBtn.disabled) throw new Error("disabled while pending");
    ctx.geo.calls[0].success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();
    if (ctx.geoBtn.disabled) throw new Error("button re-enabled after success");
    if (pendingStatus.test(ctx.status.textContent)) throw new Error("no stuck loading status");
  });
}
{
  const ctx = setup();
  await checkAsync("GL-19b loading recovers after failure", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].error({ code: 3, message: "timeout" });
    await flush();
    if (ctx.geoBtn.disabled) throw new Error("button re-enabled after failure");
    if (pendingStatus.test(ctx.status.textContent)) throw new Error("no stuck loading status");
  });
}
{
  const ctx = setup();
  await checkAsync("GL-19c retry after failure works", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    ctx.geo.calls[0].error({ code: 1, message: "denied" });
    await flush();
    fire(ctx.geoBtn, "click");
    await flush();
    if (ctx.geo.calls.length !== 2) throw new Error("retry issues a second request");
    ctx.geo.calls[1].success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();
    if (ctx.candidate.hidden) throw new Error("retry success presents candidate");
  });
}

// ---------- GL-20 close/teardown prevents stale UI mutation ----------
{
  const ctx = setup();
  await checkAsync("GL-20 close while pending prevents stale mutation", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    const geoCall = ctx.geo.calls[0];
    fire(ctx.modal, "hidden.bs.modal");
    await flush();
    geoCall.success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();
    if (!ctx.candidate.hidden) throw new Error("close must prevent late candidate mutation");
    if (ctx.confirmBtn.disabled === false) throw new Error("confirm must stay disabled");
  });
}
{
  const ctx = setup();
  await checkAsync("GL-20b teardown while pending prevents stale mutation", async () => {
    fire(ctx.geoBtn, "click");
    await flush();
    const geoCall = ctx.geo.calls[0];
    ctx.unbind();
    await flush();
    geoCall.success({ coords: { latitude: 33.5102, longitude: 36.29128 } });
    await flush();
    if (!ctx.candidate.hidden) throw new Error("teardown must prevent late candidate mutation");
    if (ctx.confirmBtn.disabled === false) throw new Error("confirm must stay disabled");
    const state = ctx.locationService.getState();
    if (state.location.city !== "Damascus") throw new Error("location must not change after teardown");
  });
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`S6T5_GEOLOCATION_SUMMARY pass=${passed} fail=${failed.length} total=${results.length}`);
if (failed.length > 0) {
  console.error("Failed:", failed.map((r) => r.id).join(", "));
  process.exit(1);
}
process.exit(0);
