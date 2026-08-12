import assert from "node:assert/strict";
import { createQiblaRuntime } from "../../src/js/ui/sections/qibla/qibla.runtime.js";
import { FakeElement, createFakeLocationService, DAMASCUS, ALEPPO, tick } from "../helpers/runtime.mjs";

const root = new FakeElement();
const location = createFakeLocationService(DAMASCUS);
let headingListener;
const heading = {
  state: "permission-required",
  getSupport() { return { state: this.state }; },
  async requestAccess() { this.state = "available"; return { state: this.state }; },
  start(listener) { headingListener = listener; this.state = "live"; return true; },
  destroy() { headingListener = null; },
};
const qiblaService = {
  async getByLocation(place) { return { qiblaBearing: place === ALEPPO ? 120 : 165, displayDegrees: place === ALEPPO ? "120°" : "165°" }; },
};

const runtime = createQiblaRuntime({ rootElement: root, locationService: location, qiblaService, headingService: heading });
await tick();
await tick();
assert.equal(root.querySelector("[data-qibla-guidance]").textContent, "اتجاه القبلة 165° من الشمال");

root.listeners.get("click")({ target: { closest: (selector) => selector === "[data-qibla-heading-enable]" } });
await tick();
assert.equal(heading.state, "live");
headingListener({ heading: 120, accuracy: 10, isReliable: true });
assert.match(root.querySelector("[data-qibla-guidance]").textContent, /45° إلى اليمين/);
for (let index = 0; index < 18; index += 1) headingListener({ heading: 164, accuracy: 10, isReliable: true });
assert.equal(root.querySelector("[data-qibla-guidance]").textContent, "✓ أنت الآن باتجاه القبلة");

location.setLocation(ALEPPO);
await tick();
await tick();
for (let index = 0; index < 18; index += 1) headingListener({ heading: 150, accuracy: 10, isReliable: true });
assert.match(root.querySelector("[data-qibla-guidance]").textContent, /30° إلى اليسار/);
runtime.destroy();
assert.equal(headingListener, null);
assert.equal(location.listenerCount, 0);
console.log("QIBLA_RUNTIME_SUMMARY pass=1 fail=0");
