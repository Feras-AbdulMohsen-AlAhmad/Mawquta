import assert from "node:assert/strict";
import { createQiblaRuntime, isPortableQiblaDevice } from "../../src/js/ui/sections/qibla/qibla.runtime.js";
import { renderQiblaVisual } from "../../src/js/ui/sections/qibla/components/qibla-visual.component.js";
import { renderQiblaCardHead } from "../../src/js/ui/sections/qibla/components/qibla-card-head.component.js";
import { FakeElement, createFakeLocationService, DAMASCUS, ALEPPO, tick } from "../helpers/runtime.mjs";

const ANDROID_PHONE = { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile", platform: "Linux armv8l", maxTouchPoints: 5 };
const ANDROID_TABLET = { userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36", platform: "Linux armv8l", maxTouchPoints: 10 };
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 };
const IPAD = { userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", platform: "iPad", maxTouchPoints: 5 };
const IPADOS_DESKTOP_MODE = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 5 };
const WINDOWS_TOUCH_LAPTOP = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 10 };

assert.equal(isPortableQiblaDevice(ANDROID_PHONE), true);
assert.equal(isPortableQiblaDevice(ANDROID_TABLET), true);
assert.equal(isPortableQiblaDevice(IPHONE), true);
assert.equal(isPortableQiblaDevice(IPAD), true);
assert.equal(isPortableQiblaDevice(IPADOS_DESKTOP_MODE), true);
assert.equal(isPortableQiblaDevice(WINDOWS_TOUCH_LAPTOP), false);
assert.equal(isPortableQiblaDevice({ ...WINDOWS_TOUCH_LAPTOP, innerWidth: 360 }), false);

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

const runtime = createQiblaRuntime({ rootElement: root, locationService: location, qiblaService, headingService: heading, navigatorObject: ANDROID_PHONE });
await tick();
await tick();
assert.equal(root.querySelector("[data-qibla-guidance]").textContent, "اتجاه القبلة 165° من الشمال");

root.listeners.get("click")({ target: { closest: (selector) => selector === "[data-qibla-heading-enable]" } });
await tick();
assert.equal(heading.state, "live");
assert.equal(root.querySelector("[data-qibla-heading-status]").textContent, "بوصلة الجهاز مفعلة — وجّه أعلى الهاتف نحو السهم");
headingListener({ heading: 120, accuracy: 10, isReliable: true });
assert.equal(root.querySelector("[data-qibla-guidance]").textContent, "القبلة إلى يمين اتجاه الهاتف — وجّه أعلى الهاتف نحو السهم");
for (let index = 0; index < 18; index += 1) headingListener({ heading: 164, accuracy: 10, isReliable: true });
assert.equal(root.querySelector("[data-qibla-guidance]").textContent, "✓ أنت الآن باتجاه القبلة");

location.setLocation(ALEPPO);
await tick();
await tick();
for (let index = 0; index < 18; index += 1) headingListener({ heading: 150, accuracy: 10, isReliable: true });
assert.equal(root.querySelector("[data-qibla-guidance]").textContent, "القبلة إلى يسار اتجاه الهاتف — وجّه أعلى الهاتف نحو السهم");
runtime.destroy();
assert.equal(headingListener, null);
assert.equal(location.listenerCount, 0);

const desktopRoot = new FakeElement();
const desktopLocation = createFakeLocationService(DAMASCUS);
let desktopPermissionRequests = 0;
let desktopStarts = 0;
const desktopHeading = {
  getSupport: () => ({ state: "available" }),
  async requestAccess() { desktopPermissionRequests += 1; return { state: "available" }; },
  start() { desktopStarts += 1; return true; },
  destroy() {},
};
const toastMessages = [];
const desktopRuntime = createQiblaRuntime({
  rootElement: desktopRoot,
  locationService: desktopLocation,
  qiblaService,
  headingService: desktopHeading,
  navigatorObject: WINDOWS_TOUCH_LAPTOP,
  toastController: { show(type, message) { toastMessages.push({ type, message }); } },
});
await tick();
assert.equal(desktopRoot.querySelector("[data-qibla-unsupported]").hidden, false);
assert.equal(desktopRoot.querySelector("[data-qibla-heading-enable]").hidden, true);
assert.equal(desktopRoot.querySelector("[data-qibla-guidance]").hidden, true);
assert.equal(desktopRoot.querySelector("[data-qibla-phone-guide]").hidden, true);
assert.equal(desktopRoot.querySelector("[data-qibla-guidance]").textContent, "اتجاه القبلة 165° من الشمال");
assert.equal(desktopRoot.querySelector("[data-qibla-city]").textContent, "دمشق، سوريا");
desktopRoot.listeners.get("click")({ target: { closest: (selector) => selector === "[data-qibla-heading-enable]" } });
await tick();
assert.equal(desktopPermissionRequests, 0);
assert.equal(desktopStarts, 0);
assert.deepEqual(toastMessages, [{
  type: "info",
  message: "البوصلة غير مدعومة على هذا الجهاز. استخدم هاتفًا أو جهازًا لوحيًا يدعم مستشعرات الاتجاه لتفعيلها.",
}]);
desktopRuntime.destroy();

const unavailableRoot = new FakeElement();
const unavailableRuntime = createQiblaRuntime({
  rootElement: unavailableRoot,
  locationService: createFakeLocationService(DAMASCUS),
  qiblaService,
  headingService: { getSupport: () => ({ state: "unsupported" }), destroy() {} },
  navigatorObject: ANDROID_TABLET,
});
await tick();
assert.equal(unavailableRoot.querySelector("[data-qibla-unsupported]").hidden, true);
assert.equal(unavailableRoot.querySelector("[data-qibla-heading-enable]").hidden, true);
assert.equal(unavailableRoot.querySelector("[data-qibla-guidance]").hidden, false);
assert.equal(unavailableRoot.querySelector("[data-qibla-phone-guide]").hidden, false);
assert.equal(unavailableRoot.querySelector("[data-qibla-heading-status]").textContent, "البوصلة الحية غير متاحة على هذا الجهاز");
unavailableRuntime.destroy();

const deniedRoot = new FakeElement();
const deniedHeading = {
  state: "permission-required",
  getSupport() { return { state: this.state }; },
  async requestAccess() { this.state = "permission-denied"; return { state: this.state }; },
  destroy() {},
};
const deniedRuntime = createQiblaRuntime({
  rootElement: deniedRoot,
  locationService: createFakeLocationService(DAMASCUS),
  qiblaService,
  headingService: deniedHeading,
  navigatorObject: IPHONE,
});
await tick();
deniedRoot.listeners.get("click")({ target: { closest: (selector) => selector === "[data-qibla-heading-enable]" } });
await tick();
assert.equal(deniedRoot.querySelector("[data-qibla-heading-status]").textContent, "تعذر تفعيل البوصلة. يمكنك استخدام الاتجاه الثابت.");
assert.equal(deniedRoot.querySelector("[data-qibla-guidance]").textContent, "اتجاه القبلة 165° من الشمال");
deniedRuntime.destroy();

const visualMarkup = renderQiblaVisual();
assert.match(visualMarkup, /البوصلة غير متاحة على هذا الجهاز/);
assert.match(visualMarkup, /ميزة البوصلة تعمل على الهواتف والأجهزة اللوحية/);
assert.match(visualMarkup, /اتجاه أعلى الهاتف/);
assert.match(visualMarkup, /اجعل أعلى هاتفك نحو هذا المؤشر/);
assert.doesNotMatch(visualMarkup, /qibla-compass__forward-marker/);
assert.doesNotMatch(visualMarkup, /alert\(/);

const headerMarkup = renderQiblaCardHead("qiblaCityModal", {
  cityName: "دمشق، سوريا",
  statusLabel: "اتجاه القبلة محسوب من موقعك الحالي",
  displayDegrees: "165°",
});
assert.match(headerMarkup, /<span>اتجاه القبلة<\/span>/);
assert.match(headerMarkup, /دمشق، سوريا/);
assert.doesNotMatch(headerMarkup, /data-qibla-deg|data-qibla-status|165°|محسوب من موقعك الحالي/);

console.log("QIBLA_RUNTIME_SUMMARY pass=11 fail=0");
