// S6-T3 LOCATION SEARCH CLIENT RESILIENCE — deterministic interaction suite.
// Imports the production client modules and drives the real picker binding with
// fake timers + manual-deferred fetch mocks so request ordering and races are
// fully deterministic. Also covers the search service, selection integrity,
// lifecycle/teardown, coordinate-less Qibla compatibility and accessibility
// semantics.

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import { checkAsync, finish } from "../helpers/runtime.mjs";

import "../helpers/setup.mjs";

import {
  SRC,
  FakeElement,
  fire,
  flush,
  listenerCount,
  makeFakeDocument,
  createTimerMock,
  createFetchMock,
  okResponse,
  httpError,
  qParam,
  tickReal,
} from "../helpers/dom-fetch.mjs";

const loadUrl = (p) => import(pathToFileURL(p).href);

const { bindLocationPickerInteractions } = await loadUrl(
  `${SRC}/ui/sections/qibla/interactions/location-picker.interactions.js`,
);
const { searchCitySuggestions } = await loadUrl(
  `${SRC}/services/location-search.service.js`,
);
const { createLocationService } = await loadUrl(
  `${SRC}/services/location.service.js`,
);
const { createQiblaService } = await loadUrl(
  `${SRC}/services/qibla.service.js`,
);
const { CONFIG } = await loadUrl(`${SRC}/config/app.config.js`);

function freshPicker() {
  const timers = createTimerMock();
  const fetchMock = createFetchMock();
  fetchMock.install();
  const dom = makeFakeDocument();
  const locationService = createLocationService();
  locationService.initialize();
  const unbind = bindLocationPickerInteractions(dom.doc, locationService);
  return { timers, fetchMock, dom, locationService, unbind };
}

function typeAndRun(p, text) {
  p.dom.input.value = text;
  fire(p.dom.input, "input");
  p.timers.runAll();
}

const HOMS_RESULTS = [
  {
    label: "Homs, Syria",
    city: "Homs",
    country: "Syria",
    lat: 34.7308,
    lon: 36.7094,
    timezone: "Asia/Damascus",
  },
];

// ---------------------------------------------------------------------------
// LS-01  normal query returns normalized results
// ---------------------------------------------------------------------------
await checkAsync("LS-01", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    assert.equal(p.fetchMock.calls.length, 1, "exactly one request");
    const call = p.fetchMock.calls[0];
    assert.match(call.url, /\/api\/geocode\b/);
    assert.equal(qParam(call.url, "q"), "Homs");
    assert.equal(qParam(call.url, "limit"), "8");
    assert.equal(qParam(call.url, "lang"), "ar");

    call.resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(p.dom.results._children.length, 1, "one result row rendered");
    assert.match(p.dom.results._children[0].textContent, /Homs/);
    assert.match(p.dom.status.textContent, /اختر نتيجة/);
    assert.equal(p.dom.confirmBtn.disabled, true, "confirm still disabled");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-02  short/empty query does not request
// ---------------------------------------------------------------------------
await checkAsync("LS-02", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Ho");
    await flush();
    assert.equal(p.fetchMock.calls.length, 0, "2-char query must not request");
    assert.match(p.dom.status.textContent, /أدخل ثلاثة أحرف/);

    typeAndRun(p, "");
    await flush();
    assert.equal(p.fetchMock.calls.length, 0, "empty query must not request");

    typeAndRun(p, "  ");
    await flush();
    assert.equal(p.fetchMock.calls.length, 0, "whitespace query must not request");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-03  leading/trailing spaces normalized
// ---------------------------------------------------------------------------
await checkAsync("LS-03", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "  Homs  ");
    await flush();
    assert.equal(p.fetchMock.calls.length, 1);
    assert.equal(qParam(p.fetchMock.calls[0].url, "q"), "Homs", "trimmed query");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-04  rapid typing does not render stale response
// ---------------------------------------------------------------------------
await checkAsync("LS-04", async () => {
  const p = freshPicker();
  try {
    // D, Da are below min length: no timers, no requests.
    typeAndRun(p, "D");
    await flush();
    typeAndRun(p, "Da");
    await flush();
    assert.equal(p.fetchMock.calls.length, 0, "no request below min length");

    // First debounced search for "Dam" actually fires and stays in flight.
    typeAndRun(p, "Dam");
    await flush();
    assert.equal(p.fetchMock.calls.length, 1, "one request for Dam");

    // Newer keystroke while the old response is pending.
    typeAndRun(p, "Dama");
    await flush();
    assert.equal(p.fetchMock.calls.length, 2, "one new request for Dama");

    const older = p.fetchMock.calls[0];
    const newer = p.fetchMock.calls[1];
    newer.resolve(
      okResponse([
        {
          label: "Damascus, Syria",
          city: "Damascus",
          country: "Syria",
          lat: 33.5138,
          lon: 36.2765,
          timezone: "Asia/Damascus",
        },
      ]),
    );
    await flush();
    assert.match(
      p.dom.results._children[0].textContent,
      /دمشق/,
      "newer result rendered",
    );

    older.resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(p.dom.results._children.length, 1, "stale response not appended");
    assert.match(
      p.dom.results._children[0].textContent,
      /دمشق/,
      "stale response did not replace newer results",
    );
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-05  old request cancelled or safely ignored
// ---------------------------------------------------------------------------
await checkAsync("LS-05", async () => {
  // Part A: with a co-operating fetch, the old request is cancelled via abort.
  {
    const p = freshPicker();
    try {
      typeAndRun(p, "Homs");
      await flush();
      typeAndRun(p, "Homsa");
      await flush();
      assert.equal(p.fetchMock.calls.length, 2);
      const older = p.fetchMock.calls[0];
      assert.equal(older.opts.signal.aborted, true, "old request aborted");
      const newer = p.fetchMock.calls[1];
      newer.resolve(okResponse(HOMS_RESULTS));
      await flush();
      assert.equal(p.dom.results._children.length, 1);
    } finally {
      p.timers.restore();
      p.fetchMock.restore();
    }
  }

  // Part B: even if the transport ignores the signal, the sequence guard
  // silently drops the late old response (no stale render, no crash).
  {
    const p = freshPicker();
    p.fetchMock = createFetchMock({ wireAbort: false });
    p.fetchMock.install();
    try {
      typeAndRun(p, "Homs");
      await flush();
      typeAndRun(p, "Homsa");
      await flush();
      assert.equal(p.fetchMock.calls.length, 2);
      const newer = p.fetchMock.calls[1];
      newer.resolve(
        okResponse([
          {
            label: "Homs Al-Akrad, Syria",
            city: "Homs Al-Akrad",
            country: "Syria",
            lat: 34.0,
            lon: 36.0,
            timezone: "Asia/Damascus",
          },
        ]),
      );
      await flush();
      const older = p.fetchMock.calls[0];
      older.resolve(okResponse(HOMS_RESULTS));
      await flush();
      assert.equal(p.dom.results._children.length, 1);
      assert.match(
        p.dom.results._children[0].textContent,
        /Homs Al-Akrad/,
        "late old response ignored by sequence guard",
      );
    } finally {
      p.timers.restore();
      p.fetchMock.restore();
    }
  }
});

// ---------------------------------------------------------------------------
// LS-06  AbortError does not surface as UI error
// ---------------------------------------------------------------------------
await checkAsync("LS-06", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    typeAndRun(p, "Homsx");
    await flush();
    // Resolve the newer search to a full render.
    p.fetchMock.calls[1].resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(p.dom.results._children.length, 1);
    assert.doesNotMatch(p.dom.status.textContent, /تعذر/);

    // Abort that fires while no replacement search is running.
    typeAndRun(p, "Homsy");
    await flush();
    p.dom.input.value = "";
    fire(p.dom.input, "input");
    await flush();
    await sleepFlush(p);

    assert.equal(unhandled.length, 0, `no unhandled rejection (${unhandled.join(",")})`);
    assert.equal(
      unhandled.some((r) => r?.name === "AbortError"),
      false,
      "AbortError never surfaces uncaught",
    );
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
    p.timers.restore();
    p.fetchMock.restore();
  }
});

function sleepFlush(p) {
  return tickReal().then(() => tickReal());
}

// ---------------------------------------------------------------------------
// LS-07  clear query while pending leaves idle/empty state
// ---------------------------------------------------------------------------
await checkAsync("LS-07", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    assert.equal(p.fetchMock.calls.length, 1, "request pending");

    p.dom.input.value = "";
    fire(p.dom.input, "input");
    await flush();
    assert.match(p.dom.status.textContent, /أدخل ثلاثة أحرف/);
    assert.equal(p.dom.results._children.length, 0, "results cleared");

    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(
      p.dom.results._children.length,
      0,
      "late response must not render after query cleared",
    );
    assert.match(p.dom.status.textContent, /أدخل ثلاثة أحرف/);
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-08  network failure renders recoverable error
// ---------------------------------------------------------------------------
await checkAsync("LS-08", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    p.fetchMock.calls[0].reject(new TypeError("Failed to fetch"));
    await flush();
    assert.match(
      p.dom.status.textContent,
      /حاول مجددًا/,
      "network failure must render a recoverable error status",
    );
    assert.equal(p.dom.results._children.length, 0);
    assert.deepEqual(
      p.dom.status.classListToggles.some((t) => t.cls === "text-danger" && t.on),
      true,
      "error status styled as error",
    );
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }

  // HTTP failure from /api/geocode is an error too, never an empty state.
  {
    const p2 = freshPicker();
    try {
      typeAndRun(p2, "Damascus");
      await flush();
      p2.fetchMock.calls[0].resolve(httpError(500));
      await flush();
      assert.match(
        p2.dom.status.textContent,
        /حاول مجددًا/,
        "HTTP 500 renders a recoverable error status",
      );
      assert.equal(p2.dom.results._children.length, 0);
    } finally {
      p2.timers.restore();
      p2.fetchMock.restore();
    }
  }
});

// ---------------------------------------------------------------------------
// LS-09  next valid query recovers after failure
// ---------------------------------------------------------------------------
await checkAsync("LS-09", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    p.fetchMock.calls[0].reject(new TypeError("Failed to fetch"));
    await flush();

    typeAndRun(p, "Aleppo");
    await flush();
    assert.equal(p.fetchMock.calls.length, 2, "new query issued after failure");
    p.fetchMock.calls[1].resolve(
      okResponse([
        {
          label: "Aleppo, Syria",
          city: "Aleppo",
          country: "Syria",
          lat: 36.2021,
          lon: 37.1343,
          timezone: "Asia/Damascus",
        },
      ]),
    );
    await flush();
    assert.equal(p.dom.results._children.length, 1, "recovered to success render");
    assert.match(p.dom.status.textContent, /اختر نتيجة/);
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-10  repeated same query avoids unnecessary duplicate behaviour
// ---------------------------------------------------------------------------
await checkAsync("LS-10", async () => {
  const p = freshPicker();
  try {
    // Rapid repeated identical values inside the debounce window -> one request.
    for (let i = 0; i < 5; i += 1) {
      p.dom.input.value = "Homs";
      fire(p.dom.input, "input");
    }
    p.timers.runAll();
    await flush();
    assert.equal(p.fetchMock.calls.length, 1, "single request for repeated same query");

    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(p.dom.results._children.length, 1);

    // Re-issuing the same query after completion is one fresh request, never a
    // concurrent duplicate storm.
    p.dom.input.value = "Homs";
    fire(p.dom.input, "input");
    p.timers.runAll();
    await flush();
    assert.equal(p.fetchMock.calls.length, 2, "one new request after completion");
    assert.equal(p.fetchMock.calls[1].opts.signal.aborted, false);
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-11  selection matches confirmed location
// ---------------------------------------------------------------------------
await checkAsync("LS-11", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(p.dom.results._children.length, 1);

    const button = p.dom.results._children[0];
    fire(button, "click");
    assert.equal(p.dom.candidate.hidden, false, "candidate shown");
    assert.equal(p.dom.confirmBtn.disabled, false, "confirm enabled after selection");
    assert.match(p.dom.status.textContent, /راجع الموقع المقترح/);

    fire(p.dom.confirmBtn, "click");
    const accepted = p.locationService.getState().location;
    assert.equal(accepted.type, "city");
    assert.equal(accepted.city, "Homs");
    assert.equal(accepted.country, "Syria");
    assert.equal(accepted.latitude, 34.7308);
    assert.equal(accepted.longitude, 36.7094);
    assert.equal(accepted.timezone, "Asia/Damascus");
    assert.equal(accepted.source, "user");
    assert.match(p.dom.current.textContent, /Homs/);

    // Double confirm is a harmless no-op (candidate already cleared).
    fire(p.dom.confirmBtn, "click");
    assert.equal(p.locationService.getState().location.city, "Homs");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-12  edited query invalidates stale selection
// ---------------------------------------------------------------------------
await checkAsync("LS-12", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    fire(p.dom.results._children[0], "click");
    assert.equal(p.dom.confirmBtn.disabled, false);

    typeAndRun(p, "Aleppo");
    await flush();
    assert.equal(p.dom.candidate.hidden, true, "stale candidate cleared on edit");
    assert.equal(p.dom.confirmBtn.disabled, true, "confirm disabled after edit");
    assert.equal(p.dom.candidate.textContent, "");

    p.fetchMock.calls[1].resolve(
      okResponse([
        {
          label: "Aleppo, Syria",
          city: "Aleppo",
          country: "Syria",
          lat: 36.2021,
          lon: 37.1343,
          timezone: "Asia/Damascus",
        },
      ]),
    );
    await flush();
    fire(p.dom.results._children[0], "click");
    fire(p.dom.confirmBtn, "click");
    assert.equal(p.locationService.getState().location.city, "Aleppo");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-13  modal close prevents late render
// ---------------------------------------------------------------------------
await checkAsync("LS-13", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    assert.equal(p.fetchMock.calls.length, 1);

    fire(p.dom.modal, "hidden.bs.modal");
    assert.equal(p.dom.results._children.length, 0, "results cleared on close");
    assert.equal(p.dom.input.value, "", "input cleared on close");

    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    assert.equal(p.dom.results._children.length, 0, "no late render after close");
    assert.match(p.dom.status.textContent, /ابحث عن مدينة/);
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-14  reopen works cleanly (and close-without-confirm leaves state clean)
// ---------------------------------------------------------------------------
await checkAsync("LS-14", async () => {
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    fire(p.dom.results._children[0], "click");
    assert.equal(p.dom.confirmBtn.disabled, false);

    // Close without confirm: candidate and results are discarded.
    fire(p.dom.modal, "hidden.bs.modal");
    assert.equal(p.dom.candidate.hidden, true);
    assert.equal(p.dom.confirmBtn.disabled, true);

    // Reopen and search again: state is clean, no ghosts.
    fire(p.dom.modal, "shown.bs.modal");
    p.timers.runAll();
    typeAndRun(p, "Aleppo");
    await flush();
    assert.equal(p.fetchMock.calls.length, 2);
    p.fetchMock.calls[1].resolve(
      okResponse([
        {
          label: "Aleppo, Syria",
          city: "Aleppo",
          country: "Syria",
          lat: 36.2021,
          lon: 37.1343,
          timezone: "Asia/Damascus",
        },
      ]),
    );
    await flush();
    assert.equal(p.dom.results._children.length, 1, "reopened search works");
    assert.match(p.dom.results._children[0].textContent, /Aleppo/);
    assert.equal(p.locationService.getState().location.city, "Damascus");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-15  no duplicate listeners after reopen; unbind detaches everything
// ---------------------------------------------------------------------------
await checkAsync("LS-15", async () => {
  const p = freshPicker();
  try {
    assert.equal(listenerCount(p.dom.input, "input"), 1);
    assert.equal(listenerCount(p.dom.geoBtn, "click"), 1);
    assert.equal(listenerCount(p.dom.confirmBtn, "click"), 1);
    assert.equal(listenerCount(p.dom.modal, "hidden.bs.modal"), 1);
    assert.equal(listenerCount(p.dom.modal, "shown.bs.modal"), 1);

    for (let i = 0; i < 3; i += 1) {
      fire(p.dom.modal, "shown.bs.modal");
      p.timers.runAll();
      fire(p.dom.modal, "hidden.bs.modal");
    }
    assert.equal(listenerCount(p.dom.input, "input"), 1, "no duplicated input listener");
    assert.equal(listenerCount(p.dom.modal, "hidden.bs.modal"), 1, "no duplicated hidden listener");
    assert.equal(listenerCount(p.dom.modal, "shown.bs.modal"), 1, "no duplicated shown listener");

    p.unbind();
    assert.equal(listenerCount(p.dom.input, "input"), 0, "input unbound");
    assert.equal(listenerCount(p.dom.geoBtn, "click"), 0, "geo unbound");
    assert.equal(listenerCount(p.dom.confirmBtn, "click"), 0, "confirm unbound");
    assert.equal(listenerCount(p.dom.modal, "hidden.bs.modal"), 0, "hidden unbound");
    assert.equal(listenerCount(p.dom.modal, "shown.bs.modal"), 0, "shown unbound");
    assert.equal(p.dom.modal.listeners.size, 0, "no listeners left");

    // No post-unbind search happens on input events (handler is gone).
    p.dom.input.value = "Homs";
    assert.throws(
      () => fire(p.dom.input, "input"),
      /no "input" listener/,
      "input handler detached after unbind",
    );
    p.timers.runAll();
    await flush();
    assert.equal(p.fetchMock.calls.length, 0, "no search after unbind");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

// ---------------------------------------------------------------------------
// LS-16  coordinate-less Qibla still resolves
// ---------------------------------------------------------------------------
await checkAsync("LS-16", async () => {
  let geocodeCalls = 0;
  const qibla = createQiblaService({
    geocodeCity: async () => {
      geocodeCalls += 1;
      return { latitude: 34.7308, longitude: 36.7094 };
    },
  });
  const coordless = {
    type: "city",
    city: "Homs",
    country: "Syria",
    latitude: null,
    longitude: null,
    timezone: "Asia/Damascus",
  };
  const contract = await qibla.getByLocation(coordless);
  assert.equal(geocodeCalls, 1, "one lookup for coordinate-less city");
  assert.equal(contract.latitude, 34.7308);
  assert.equal(contract.longitude, 36.7094);
  assert.ok(Number.isFinite(contract.qiblaBearing));
  assert.match(contract.cityName, /Homs/);

  // In-flight / same-session dedupe: second call uses the cache.
  await qibla.getByLocation(coordless);
  assert.equal(geocodeCalls, 1, "lookup deduped per city");

  // Curated default Damascus resolves without any geocode lookup.
  const qibla2 = createQiblaService({
    geocodeCity: async () => {
      throw new Error("geocode must not run for default Damascus");
    },
  });
  const dam = await qibla2.getByLocation({
    type: "city",
    city: "Damascus",
    country: "Syria",
    latitude: null,
    longitude: null,
    timezone: "Asia/Damascus",
  });
  assert.equal(dam.latitude, CONFIG.DEFAULT_LOCATION_COORDS.latitude);
  assert.equal(dam.longitude, CONFIG.DEFAULT_LOCATION_COORDS.longitude);
});

// ---------------------------------------------------------------------------
// LS-17  no automatic geolocation during search flows
// ---------------------------------------------------------------------------
await checkAsync("LS-17", async () => {
  let geoCalls = 0;
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      ...(globalThis.navigator || {}),
      geolocation: {
        getCurrentPosition: () => {
          geoCalls += 1;
        },
      },
    },
  });
  const p = freshPicker();
  try {
    typeAndRun(p, "Homs");
    await flush();
    p.fetchMock.calls[0].resolve(okResponse(HOMS_RESULTS));
    await flush();
    fire(p.dom.results._children[0], "click");
    fire(p.dom.confirmBtn, "click");
    assert.equal(geoCalls, 0, "no geolocation during search/select/confirm");
    assert.equal(p.locationService.getState().location.source, "user");
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

// ---------------------------------------------------------------------------
// LS-18  accessibility status/focus semantics preserved
// ---------------------------------------------------------------------------
await checkAsync("LS-18", async () => {
  const componentSource = await fs.readFile(
    `${SRC}/ui/sections/qibla/components/qibla-city-modal.component.js`,
    "utf8",
  );
  for (const needle of [
    'role="status"',
    'aria-live="polite"',
    'id="locationPickerStatus"',
    'aria-describedby="locationPickerStatus"',
    'role="listbox"',
    'aria-label="نتائج البحث عن المدن"',
    'data-bs-dismiss="modal"',
    'aria-label="إغلاق"',
  ]) {
    assert.ok(componentSource.includes(needle), `static markup keeps ${needle}`);
  }
  assert.ok(componentSource.includes('class="visually-hidden"'), "hidden label present");

  const p = freshPicker();
  try {
    // Initial semantics: input focused on open, confirm disabled, no results.
    fire(p.dom.modal, "shown.bs.modal");
    p.timers.runAll();
    assert.equal(p.dom.confirmBtn.disabled, true, "confirm starts disabled");
    assert.equal(p.dom.results._children.length, 0);

    // After a successful search + keyboard-accessible selection the status is a
    // polite candidate hint (required by S5-T6 AX-05).
    typeAndRun(p, "Aleppo");
    await flush();
    p.fetchMock.calls[0].resolve(
      okResponse([
        {
          label: "Aleppo, Syria",
          city: "Aleppo",
          country: "Syria",
          lat: 36.2021,
          lon: 37.1343,
          timezone: "Asia/Damascus",
        },
      ]),
    );
    await flush();
    assert.equal(p.dom.results._children.length, 1);
    fire(p.dom.results._children[0], "click");
    assert.equal(p.dom.confirmBtn.disabled, false);
    assert.match(p.dom.status.textContent, /راجع الموقع المقترح/);
    assert.equal(
      p.dom.results._children[0].getAttribute("role"),
      "option",
      "result row keeps role=option",
    );
  } finally {
    p.timers.restore();
    p.fetchMock.restore();
  }
});

await finish("S6T3_LOCATION_SEARCH");

