// S6-T2 deterministic serverless geocode API harness.
// Imports api/geocode.js directly (no server), stubs globalThis.fetch, and
// exercises the full GEO-* matrix against the CURRENT production handler.

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const HANDLER_URL = new URL("../../api/geocode.js", import.meta.url).href;
const { default: handler } = await import(HANDLER_URL);

const USERNAME = "test-geonames-user";
process.env.GEONAMES_USERNAME = USERNAME;

const results = [];
function record(id, pass, detail) {
  results.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${detail}`);
}

function makeReq({ method = "GET", query = {} } = {}) {
  return { method, query };
}

function makeRes() {
  const calls = [];
  const res = {
    calls,
    status(code) {
      calls.push(["status", code]);
      return res;
    },
    json(body) {
      calls.push(["json", body]);
      return res;
    },
    setHeader(name, value) {
      calls.push(["header", name, String(value)]);
      return res;
    },
    get statusCode() {
      const s = calls.find((c) => c[0] === "status");
      return s ? s[1] : null;
    },
    get body() {
      const j = calls.find((c) => c[0] === "json");
      return j ? j[1] : null;
    },
  };
  return res;
}

function upstreamPayload(rows = []) {
  return { geonames: rows };
}

function geonamesRow(overrides = {}) {
  return {
    name: "Damascus",
    countryName: "Syria",
    lat: "33.5102",
    lng: "36.29128",
    population: 2715577,
    timezone: { timeZoneId: "Asia/Damascus" },
    ...overrides,
  };
}

let lastFetchUrl = null;
let lastFetchOptions = null;
let fetchCallCount = 0;

function installFetch(mode = "ok", data = upstreamPayload()) {
  fetchCallCount = 0;
  lastFetchUrl = null;
  lastFetchOptions = null;
  globalThis.fetch = async (url, options) => {
    fetchCallCount += 1;
    lastFetchUrl = url;
    lastFetchOptions = options;
    if (mode === "ok") {
      return { ok: true, status: 200, json: async () => data };
    }
    if (mode === "malformed-json") {
      return {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      };
    }
    if (mode === "upstream-error") {
      return { ok: false, status: data.status || 500, json: async () => ({}) };
    }
    if (mode === "network-failure") {
      throw new TypeError("fetch failed");
    }
    if (mode === "hang") {
      return new Promise((resolve, reject) => {
        const signal = options?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted due to timeout");
            err.name = "TimeoutError";
            reject(err);
          });
        }
      });
    }
    throw new Error(`unknown fetch mode: ${mode}`);
  };
}

function restoreFetch() {
  delete globalThis.fetch;
}

async function call(method = "GET", query = {}) {
  const req = makeReq({ method, query });
  const res = makeRes();
  await handler(req, res);
  return res;
}

const RESULT_KEYS = ["label", "city", "country", "lat", "lon", "timezone"];

async function run() {
  // ---------- GEO-01 valid Arabic city ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    const res = await call("GET", { q: "دمشق", lang: "ar", limit: "3" });
    record(
      "GEO-01",
      res.statusCode === 200 &&
        res.body?.ok === true &&
        Array.isArray(res.body?.results) &&
        res.body.results[0]?.city === "Damascus" &&
        res.body.results[0]?.country === "Syria",
      `status=${res.statusCode} results=${res.body?.results?.length}`,
    );
    record(
      "GEO-01b",
      fetchCallCount === 1 &&
        lastFetchUrl.includes("name_startsWith=%D8%AF%D9%85%D8%B4%D9%82") &&
        lastFetchUrl.includes("lang=ar"),
      "upstream called once with Arabic q + lang=ar",
    );
    restoreFetch();
  }

  // ---------- GEO-02 valid English city ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    const res = await call("GET", { q: "Damascus", lang: "en", limit: "3" });
    record(
      "GEO-02",
      res.statusCode === 200 &&
        res.body?.ok === true &&
        res.body?.results[0]?.city === "Damascus",
      `status=${res.statusCode} firstCity=${res.body?.results?.[0]?.city}`,
    );
    record(
      "GEO-02b",
      lastFetchUrl.includes("lang=en") && lastFetchUrl.includes("username=" + USERNAME),
      "upstream lang=en + server-side username param",
    );
    restoreFetch();
  }

  // ---------- GEO-03 missing q ----------
  {
    installFetch("ok");
    const res = await call("GET", {});
    record(
      "GEO-03",
      res.statusCode === 200 &&
        res.body?.ok === true &&
        Array.isArray(res.body?.results) &&
        res.body.results.length === 0 &&
        fetchCallCount === 0,
      "missing q -> 200 empty, no upstream call",
    );
    restoreFetch();
  }

  // ---------- GEO-04 blank / whitespace-only q ----------
  {
    installFetch("ok");
    const res = await call("GET", { q: "   " });
    record(
      "GEO-04",
      res.statusCode === 200 &&
        res.body?.ok === true &&
        res.body?.results?.length === 0 &&
        fetchCallCount === 0,
      "whitespace q -> 200 empty, no upstream call",
    );
    restoreFetch();
  }

  // ---------- GEO-05 invalid limit ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", limit: "0" });
    const maxRows0 = new URL(lastFetchUrl).searchParams.get("maxRows");
    record("GEO-05a", maxRows0 !== "0", `limit=0 -> maxRows=${maxRows0} (invalid should NOT reach upstream)`);
    restoreFetch();
  }
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", limit: "-3" });
    const maxRowsNeg = new URL(lastFetchUrl).searchParams.get("maxRows");
    record("GEO-05b", maxRowsNeg !== "-3", `limit=-3 -> maxRows=${maxRowsNeg} (invalid should NOT reach upstream)`);
    restoreFetch();
  }
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", limit: "abc" });
    const maxRowsNaN = new URL(lastFetchUrl).searchParams.get("maxRows");
    record("GEO-05c", maxRowsNaN !== "NaN", `limit=abc -> maxRows=${maxRowsNaN} (invalid should NOT reach upstream)`);
    restoreFetch();
  }
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus" });
    const maxRowsDefault = new URL(lastFetchUrl).searchParams.get("maxRows");
    record("GEO-05d", maxRowsDefault === "8", `missing limit -> maxRows=${maxRowsDefault} (default 8)`);
    restoreFetch();
  }

  // ---------- GEO-06 excessive limit ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", limit: "500" });
    const maxRowsMax = new URL(lastFetchUrl).searchParams.get("maxRows");
    record("GEO-06", maxRowsMax === "12", `limit=500 -> maxRows=${maxRowsMax} (clamped to 12)`);
    restoreFetch();
  }

  // ---------- GEO-07 unsupported method ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    const res = await call("POST", { q: "Damascus" });
    record(
      "GEO-07",
      res.statusCode === 405 &&
        res.body?.ok === false &&
        fetchCallCount === 0,
      `POST -> status=${res.statusCode} upstreamCalls=${fetchCallCount} (expected 405, no upstream)`,
    );
    restoreFetch();
  }

  // ---------- GEO-08 upstream empty + malformed JSON ----------
  {
    installFetch("ok", upstreamPayload([]));
    const res = await call("GET", { q: "Damascus" });
    record(
      "GEO-08",
      res.statusCode === 200 && res.body?.ok === true && res.body?.results?.length === 0,
      "upstream empty geonames -> 200 empty results",
    );
    restoreFetch();
  }
  {
    installFetch("malformed-json");
    const res = await call("GET", { q: "Damascus" });
    record(
      "GEO-08b",
      res.statusCode === 500 &&
        res.body?.ok === false &&
        res.body?.error === "Unexpected server error",
      "upstream malformed JSON -> 500 generic (no crash, no raw body)",
    );
    restoreFetch();
  }

  // ---------- GEO-09 upstream malformed rows ----------
  {
    const rows = [
      geonamesRow(), // valid
      geonamesRow({ name: "", countryName: "Syria", lat: "33", lng: "36", timezone: { timeZoneId: "Asia/Damascus" } }), // blank city
      geonamesRow({ name: "Bad1", countryName: "", lat: "33", lng: "36", timezone: { timeZoneId: "Asia/Damascus" } }), // blank country
      geonamesRow({ name: "Bad2", countryName: "X", lat: "notanum", lng: "36", timezone: { timeZoneId: "Asia/Damascus" } }), // bad lat
      geonamesRow({ name: "Bad3", countryName: "X", lat: "33", lng: "1e999", timezone: { timeZoneId: "Asia/Damascus" } }), // non-finite lon
      geonamesRow({ name: "Bad4", countryName: "X", lat: "33", lng: "36", timezone: { timeZoneId: "Not/AZone" } }), // invalid tz
      geonamesRow({ name: "Bad5", countryName: "X", lat: "33", lng: "36", timezone: null }), // missing tz
    ];
    installFetch("ok", upstreamPayload(rows));
    const res = await call("GET", { q: "Damascus" });
    record(
      "GEO-09",
      res.statusCode === 200 &&
        res.body?.results?.length === 1 &&
        res.body?.results[0]?.city === "Damascus",
      `malformed rows filtered, kept=${res.body?.results?.length} (expected 1)`,
    );
    restoreFetch();
  }

  // ---------- GEO-10 upstream 4xx/5xx ----------
  {
    installFetch("upstream-error", { status: 404 });
    const res = await call("GET", { q: "Damascus" });
    record(
      "GEO-10",
      res.statusCode === 502 &&
        res.body?.ok === false &&
        res.body?.error === "GeoNames failed: 404",
      `upstream 404 -> status=${res.statusCode} error=${res.body?.error}`,
    );
    restoreFetch();
  }
  {
    installFetch("upstream-error", { status: 503 });
    const res = await call("GET", { q: "Damascus" });
    record(
      "GEO-10b",
      res.statusCode === 502 &&
        res.body?.ok === false &&
        res.body?.error === "GeoNames failed: 503",
      `upstream 503 -> status=${res.statusCode}`,
    );
    restoreFetch();
  }

  // ---------- GEO-11 network failure ----------
  {
    installFetch("network-failure");
    const res = await call("GET", { q: "Damascus" });
    record(
      "GEO-11",
      res.statusCode === 500 &&
        res.body?.ok === false &&
        res.body?.error === "Unexpected server error" &&
        !res.body?.stack,
      "network failure -> 500 generic, no stack/raw error",
    );
    restoreFetch();
  }

  // ---------- GEO-12 timeout / hanging upstream ----------
  {
    installFetch("hang");
    const res = makeRes();
    const started = Date.now();
    const handlerPromise = handler(makeReq({ method: "GET", query: { q: "Damascus" } }), res);
    let settled = false;
    let elapsed = 0;
    handlerPromise
      .then(() => {
        settled = true;
      })
      .catch(() => {
        settled = true;
      });
    await new Promise((r) => setTimeout(r, 6200));
    elapsed = Date.now() - started;
    const timedOut = res.statusCode === 504 && res.body?.error === "GeoNames upstream timeout";
    record(
      "GEO-12",
      settled === true && timedOut,
      `hanging upstream -> settled=${settled} elapsed=${elapsed}ms status=${res.statusCode} error=${res.body?.error} (expect 504)`,
    );
    if (settled) {
      await handlerPromise;
    }
    restoreFetch();
  }

  // ---------- GEO-13 no secret leakage ----------
  {
    let leaked = false;
    let leakDetail = "";
    const cases = [
      ["ok", { q: "Damascus" }],
      ["upstream-error", { q: "Damascus" }],
      ["malformed-json", { q: "Damascus" }],
      ["network-failure", { q: "Damascus" }],
      ["ok", {}],
    ];
    for (const [mode, query] of cases) {
      installFetch(mode, mode === "upstream-error" ? { status: 502 } : upstreamPayload([geonamesRow()]));
      const res = await call("GET", query);
      const serialized = JSON.stringify(res.body);
      if (serialized.includes(USERNAME)) {
        leaked = true;
        leakDetail = `mode=${mode} contains username in response`;
        break;
      }
      restoreFetch();
    }
    restoreFetch();
    record("GEO-13", !leaked, leakDetail || "username never present in any JSON response");
  }

  // ---------- GEO-14 normalized response only ----------
  {
    const rows = [
      geonamesRow({
        adminCode1: "14",
        adminName1: "Dimashq",
        fcl: "P",
        fcode: "PPLC",
        geonameId: 167076,
        lat: "33.5102",
        lng: "36.29128",
      }),
    ];
    installFetch("ok", upstreamPayload(rows));
    const res = await call("GET", { q: "Damascus" });
    const result = res.body?.results?.[0];
    const keys = result ? Object.keys(result).sort() : [];
    const allowed = RESULT_KEYS.slice().sort();
    record(
      "GEO-14",
      res.statusCode === 200 &&
        JSON.stringify(keys) === JSON.stringify(allowed) &&
        !JSON.stringify(res.body).includes("adminCode1") &&
        !JSON.stringify(res.body).includes("geonameId"),
      `result keys=${keys.join(",")} (only label/city/country/lat/lon/timezone)`,
    );
    restoreFetch();
  }

  // ---------- GEO-15 client contract compatibility ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    const res = await call("GET", { q: "Damascus", limit: "3", lang: "ar" });
    const data = res.body;
    const clientOk = data?.ok === true && Array.isArray(data?.results);
    const fieldsOk = data?.results?.[0]
      ? RESULT_KEYS.every((k) => k in data.results[0])
      : false;
    const numbersOk = Number.isFinite(Number(data?.results?.[0]?.lat)) &&
      Number.isFinite(Number(data?.results?.[0]?.lon));
    const timezoneOk = (() => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: data?.results?.[0]?.timezone }).format();
        return true;
      } catch {
        return false;
      }
    })();
    record(
      "GEO-15",
      clientOk && fieldsOk && numbersOk && timezoneOk,
      "response shape consumable by location-search.service.js (ok/results + 6 normalized fields + finite coords + valid tz)",
    );
    restoreFetch();
  }

  // ---------- GEO-16 coordinate-less Qibla compatibility ----------
  {
    // Mirrors main.js geocodeCityCoordinates consuming the geocode result.
    const resultsPayload = upstreamPayload([geonamesRow({ name: "Homs", countryName: "Syria", lat: "34.7308", lng: "36.7094" })]);
    installFetch("ok", resultsPayload);
    const res = await call("GET", { q: "Homs", lang: "ar" });
    const best = res.body?.results?.[0];
    const latitude = Number(best?.lat);
    const longitude = Number(best?.lon);
    const validCoords =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180;

    // Actual qibla.service.js integration with injected geocodeCity.
    const { createQiblaService } = await import(
      new URL("../../src/js/services/qibla.service.js", import.meta.url).href
    );
    const qiblaService = createQiblaService({
      geocodeCity: async () => ({ latitude, longitude }),
    });
    let bearing = null;
    let error = null;
    try {
      const contract = await qiblaService.getByLocation({
        type: "city",
        city: "Homs",
        country: "Syria",
        latitude: null,
        longitude: null,
        timezone: "Asia/Damascus",
        source: "user",
      });
      bearing = contract.qiblaBearing;
    } catch (e) {
      error = e;
    }
    record(
      "GEO-16",
      validCoords && bearing !== null && Number.isFinite(bearing) && !error,
      `coordinate-less Homs -> lat=${latitude} lon=${longitude} bearing=${bearing} error=${error?.message || "none"}`,
    );
    restoreFetch();
  }

  // ---------- GEO-lang handling ----------
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", lang: "ar" });
    record("GEO-L-01", new URL(lastFetchUrl).searchParams.get("lang") === "ar", "lang=ar forwarded");
    restoreFetch();
  }
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", lang: "en" });
    record("GEO-L-02", new URL(lastFetchUrl).searchParams.get("lang") === "en", "lang=en forwarded");
    restoreFetch();
  }
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus" });
    record("GEO-L-03", new URL(lastFetchUrl).searchParams.get("lang") === "en", "missing lang -> default en");
    restoreFetch();
  }
  {
    installFetch("ok", upstreamPayload([geonamesRow()]));
    await call("GET", { q: "Damascus", lang: "xx" });
    record("GEO-L-04", new URL(lastFetchUrl).searchParams.get("lang") === "xx", "unexpected lang forwarded, no crash");
    restoreFetch();
  }

  // ---------- GEO-long very long q ----------
  {
    const longQ = "a".repeat(2000);
    installFetch("ok", upstreamPayload([geonamesRow()]));
    const res = await call("GET", { q: longQ });
    record(
      "GEO-LONG",
      res.statusCode === 200 && fetchCallCount === 1 && lastFetchUrl.includes("name_startsWith="),
      "very long q (2000 chars) -> no exception, upstream called once",
    );
    restoreFetch();
  }

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log(`\nGEOCODE_API_SUMMARY pass=${passCount} fail=${failCount} total=${results.length}`);
  process.exitCode = failCount > 0 ? 1 : 0;
}

await run();

