import { deferred, FakeElement, fire, listenerCount } from "./dom-fetch.mjs";

export function makeGeoMock() {
  const state = {
    supported: true,
    nonFunction: false,
    calls: [],
    watchCalls: 0,
  };

  function install() {
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success, error, options) {
          const d = deferred();
          state.calls.push({ success, error, options, d });
        },
        watchPosition() {
          state.watchCalls += 1;
          return 1;
        },
        clearWatch() {},
      },
    });
  }

  state.install = install;
  return state;
}

export function setGeolocationUnsupported() {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: undefined,
  });
}

export function setGeolocationNonFunction() {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: "not a function",
    },
  });
}

export function installAxiosMock({ city = "Damascus", countryName = "Syria", timezone = "Asia/Damascus", fail = false } = {}) {
  const state = { city, countryName, timezone, fail, calls: [] };
  window.axios = {
    create() {
      return {
        async get() {
          state.calls.push("get");
          if (state.fail) throw new Error("reverse geocode failed");
          return {
            data: {
              city: state.city,
              countryName: state.countryName,
              timezone: state.timezone,
              localityInfo: { informative: [] },
            },
          };
        },
      };
    },
  };
  return state;
}

export function makePickerHarness({ storage } = {}) {
  const modal = new FakeElement();
  const input = modal.querySelector("[data-location-query]");
  const results = modal.querySelector("[data-location-results]");
  const candidate = modal.querySelector("[data-location-candidate]");
  const status = modal.querySelector("[data-location-status]");
  const current = modal.querySelector("[data-location-current]");
  const confirmBtn = modal.querySelector("[data-location-confirm]");
  const geoBtn = modal.querySelector("[data-location-geolocation]");
  confirmBtn.disabled = true;
  candidate.hidden = true;
  const doc = {
    getElementById: (id) => (id === "qiblaCityModal" ? modal : null),
    querySelectorAll: () => [],
    createElement: () => new FakeElement(),
  };
  return { modal, input, results, candidate, status, current, confirmBtn, geoBtn, doc };
}

export { deferred, fire, listenerCount };
