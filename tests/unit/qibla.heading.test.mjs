import assert from "node:assert/strict";
import { extractAbsoluteHeading, extractDeviceHeading, createDeviceHeadingService } from "../../src/js/services/device-heading.service.js";
import { normalize360, shortestSignedAngle, smoothCircularAngle } from "../../src/js/utils/qibla.util.js";

assert.equal(normalize360(-1), 359);
assert.equal(shortestSignedAngle(165 - 120), 45);
assert.equal(shortestSignedAngle(120 - 165), -45);
assert.equal(shortestSignedAngle(2 - 358), 4);
assert.equal(shortestSignedAngle(358 - 2), -4);
assert.equal(shortestSignedAngle(180), -180);
assert.equal(shortestSignedAngle(-180), -180);
assert.throws(() => shortestSignedAngle(Number.NaN));

assert.equal(Math.round(smoothCircularAngle(10, 20, 1)), 20);
assert.equal(Math.round(smoothCircularAngle(359, 1, 1)), 1);
assert.equal(Math.round(smoothCircularAngle(1, 359, 1)), 359);
assert.ok(smoothCircularAngle(359, 1, 0.2) < 360 && smoothCircularAngle(359, 1, 0.2) > 359);

const webkit = extractDeviceHeading({ webkitCompassHeading: 358, webkitCompassAccuracy: 12 });
assert.deepEqual(webkit, { heading: 358, source: "webkit-compass", referenceType: "magnetic", accuracy: 12, isReliable: true });
assert.equal(extractDeviceHeading({ alpha: 10, beta: 2, gamma: 1, absolute: false }), null);
assert.equal(extractDeviceHeading({ alpha: Number.NaN, beta: 2, gamma: 1, absolute: true }), null);
assert.equal(extractAbsoluteHeading({ alpha: 0, beta: 0, gamma: 0, absolute: true }), 0);
assert.equal(extractAbsoluteHeading({ alpha: 90, beta: 0, gamma: 0, absolute: true }), 90);

const events = new Map();
const timers = new Map();
let nextTimerId = 1;
const fakeWindow = {
  isSecureContext: true,
  DeviceOrientationEvent: class DeviceOrientationEvent {},
  addEventListener(type, handler) { events.set(type, handler); },
  removeEventListener(type) { events.delete(type); },
  screen: { orientation: { angle: 0 } },
};
const service = createDeviceHeadingService({
  windowObject: fakeWindow,
  verificationSampleCount: 2,
  verificationTimeoutMs: 100,
  setTimeoutFn(handler) { const id = nextTimerId++; timers.set(id, handler); return id; },
  clearTimeoutFn(id) { timers.delete(id); },
});
assert.equal(service.getSupport().state, "available");
let received = null;
assert.equal(service.start((value) => { received = value; }), true);
assert.equal(events.size, 1);
assert.equal(timers.size, 1);
assert.equal(service.getSupport().state, "verifying");
events.get("deviceorientation")({ webkitCompassHeading: null, alpha: null, beta: null, gamma: null });
assert.equal(received, null);
events.get("deviceorientation")({ webkitCompassHeading: 120 });
assert.equal(received, null);
assert.equal(service.getSupport().state, "verifying");
events.get("deviceorientation")({ webkitCompassHeading: 121 });
assert.equal(received.heading, 121);
assert.equal(service.getSupport().state, "live");
assert.equal(timers.size, 0);

let unavailableState = null;
assert.equal(service.start(() => {}, (support) => { unavailableState = support.state; }), true);
assert.equal(events.size, 1);
assert.equal(timers.size, 1);
const [timeoutId, timeoutHandler] = timers.entries().next().value;
timers.delete(timeoutId);
timeoutHandler();
assert.equal(unavailableState, "unavailable");
assert.equal(service.getSupport().state, "unavailable");
assert.equal(events.size, 0);
assert.equal(timers.size, 0);
assert.equal(service.start(() => {}), false);
service.destroy();
assert.equal(events.size, 0);
assert.equal(timers.size, 0);

console.log("QIBLA_HEADING_SUMMARY pass=1 fail=0");
