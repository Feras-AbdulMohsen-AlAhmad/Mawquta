// S6-T3 deterministic harness helpers. Uses fake timers + manual-deferred fetch
// mocks so request ordering and race behaviour are fully controlled.

import assert from "node:assert/strict";

export const SRC = new URL("../../src/js/", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/");

const REAL_SET = globalThis.setTimeout;
const REAL_CLEAR = globalThis.clearTimeout;
export const tickReal = () => new Promise((r) => REAL_SET(r, 0));
export const sleepReal = (ms) => new Promise((r) => REAL_SET(r, ms));
export const flush = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await tickReal();
};

export class FakeElement {
  constructor() {
    this.textContent = "";
    this.innerHTML = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.type = "button";
    this.className = "";
    this._children = [];
    this._selectors = new Map();
    this.listeners = new Map();
    this.listenerLog = [];
    this.attrs = new Map();
    this.classListToggles = [];
    const styleValues = new Map();
    this.style = {
      setProperty: (name, value) => styleValues.set(name, String(value)),
      getPropertyValue: (name) => styleValues.get(name) || "",
      removeProperty: (name) => styleValues.delete(name),
    };
    this._classNames = new Set();
  }
  querySelector(selector) {
    if (!this._selectors.has(selector)) {
      this._selectors.set(selector, new FakeElement());
    }
    return this._selectors.get(selector);
  }
  addEventListener(type, handler) {
    this.listeners.set(type, handler);
    this.listenerLog.push({ type, fn: handler });
  }
  removeEventListener(type, handler) {
    if (this.listeners.get(type) === handler) this.listeners.delete(type);
    this.listenerLog = this.listenerLog.filter(
      (e) => !(e.type === type && e.fn === handler),
    );
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }
  replaceChildren() {
    this._children = [];
  }
  append(child) {
    this._children.push(child);
  }
  get children() {
    return this._children;
  }
  get classList() {
    return {
      add: (...classes) => classes.forEach((cls) => this._classNames.add(cls)),
      remove: (...classes) => classes.forEach((cls) => this._classNames.delete(cls)),
      contains: (cls) => this._classNames.has(cls),
      toggle: (cls, on) => {
        if (on) this._classNames.add(cls);
        else this._classNames.delete(cls);
        this.classListToggles.push({ cls, on });
      },
    };
  }
  focus() {}
}

export function listenerCount(element, type) {
  return element.listenerLog.filter((e) => e.type === type).length;
}

export function fire(element, type) {
  const handler = element?.listeners?.get(type);
  assert.ok(handler, `no "${type}" listener registered`);
  handler();
}

export function makeFakeDocument() {
  const modal = new FakeElement();
  const viewport = new FakeElement();
  viewport.height = 844;
  const windowTarget = new FakeElement();
  windowTarget.visualViewport = viewport;
  windowTarget.innerHeight = 844;
  const input = modal.querySelector("[data-location-query]");
  const results = modal.querySelector("[data-location-results]");
  const candidate = modal.querySelector("[data-location-candidate]");
  const status = modal.querySelector("[data-location-status]");
  const current = modal.querySelector("[data-location-current]");
  const confirmBtn = modal.querySelector("[data-location-confirm]");
  const geoBtn = modal.querySelector("[data-location-geolocation]");
  // Mirror the static component markup initial state.
  confirmBtn.disabled = true;
  candidate.hidden = true;
  const doc = {
    body: new FakeElement(),
    defaultView: windowTarget,
    getElementById: (id) => (id === "qiblaCityModal" ? modal : null),
    querySelectorAll: () => [],
    createElement: () => new FakeElement(),
  };
  return {
    modal,
    input,
    results,
    candidate,
    status,
    current,
    confirmBtn,
    geoBtn,
    viewport,
    windowTarget,
    doc,
  };
}

export function createTimerMock() {
  let seq = 0;
  const timers = new Map();
  globalThis.setTimeout = (fn) => {
    seq += 1;
    timers.set(seq, fn);
    return seq;
  };
  globalThis.clearTimeout = (id) => {
    timers.delete(id);
  };
  return {
    runAll() {
      const fns = [...timers.values()];
      timers.clear();
      for (const fn of fns) fn();
    },
    count() {
      return timers.size;
    },
    clear() {
      timers.clear();
    },
    restore() {
      globalThis.setTimeout = REAL_SET;
      globalThis.clearTimeout = REAL_CLEAR;
    },
  };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function okResponse(results) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, results }),
  };
}

export function httpError(status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({ ok: false }),
  };
}

export function createFetchMock({ wireAbort = true } = {}) {
  const calls = [];
  const makeAbortError = () =>
    new DOMException("The operation was aborted.", "AbortError");
  return {
    calls,
    install() {
      globalThis.fetch = (url, opts = {}) => {
        const d = deferred();
        const entry = {
          url: String(url),
          opts,
          resolve: d.resolve,
          reject: d.reject,
          settled: false,
        };
        calls.push(entry);
        if (opts.signal) {
          if (opts.signal.aborted) {
            entry.settled = true;
            d.reject(makeAbortError());
          } else if (wireAbort) {
            opts.signal.addEventListener(
              "abort",
              () => {
                if (!entry.settled) {
                  entry.settled = true;
                  d.reject(makeAbortError());
                }
              },
              { once: true },
            );
          }
        }
        return d.promise;
      };
    },
    restore() {
      delete globalThis.fetch;
    },
  };
}

export function qParam(urlString, name) {
  return new URL(urlString).searchParams.get(name);
}
