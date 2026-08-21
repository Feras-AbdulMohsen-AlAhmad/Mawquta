import { normalize360 } from "../utils/qibla.util.js";

export const HEADING_SOURCES = Object.freeze({
  WEBKIT: "webkit-compass",
  ABSOLUTE: "absolute-orientation",
});

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function radians(value) {
  return (value * Math.PI) / 180;
}

// W3C's rotation-matrix approach works for tilted devices; it is deliberately
// kept here so browser-specific event handling never leaks into Qibla logic.
export function extractAbsoluteHeading(event, screenAngle = 0) {
  if (!event || event.absolute !== true) return null;
  if (![event.alpha, event.beta, event.gamma].every(finite)) return null;

  const a = radians(event.alpha);
  const b = radians(event.beta);
  const g = radians(event.gamma);
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);
  const m12 = -cB * sA;
  const m22 = cA * cB;
  const heading = (Math.atan2(m12, m22) * 180) / Math.PI;
  return normalize360(-heading + (finite(screenAngle) ? screenAngle : 0));
}

export function extractDeviceHeading(event, { screenAngle = 0 } = {}) {
  if (finite(event?.webkitCompassHeading)) {
    return {
      heading: normalize360(event.webkitCompassHeading),
      source: HEADING_SOURCES.WEBKIT,
      referenceType: "magnetic",
      accuracy: finite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : null,
      isReliable: true,
    };
  }

  const heading = extractAbsoluteHeading(event, screenAngle);
  if (heading === null) return null;

  return {
    heading,
    source: HEADING_SOURCES.ABSOLUTE,
    referenceType: "absolute-earth",
    accuracy: finite(event?.accuracy) ? event.accuracy : null,
    isReliable: true,
  };
}

export function createDeviceHeadingService(options = {}) {
  const windowObject = options.windowObject ?? (typeof window !== "undefined" ? window : null);
  const screenObject = options.screenObject ?? windowObject?.screen ?? null;
  const verificationSampleCount = Math.max(1, Number(options.verificationSampleCount) || 2);
  const verificationTimeoutMs = Math.max(1, Number(options.verificationTimeoutMs) || 1500);
  const setTimer = options.setTimeoutFn ?? globalThis.setTimeout;
  const clearTimer = options.clearTimeoutFn ?? globalThis.clearTimeout;
  const orientationEvent = windowObject?.DeviceOrientationEvent;
  const secureContext = windowObject?.isSecureContext !== false;
  const hasAbsoluteEvent = Boolean(
    windowObject && ("ondeviceorientationabsolute" in windowObject || windowObject.DeviceOrientationAbsoluteEvent),
  );
  const canOrient = Boolean(windowObject && orientationEvent && secureContext);
  const permissionCallable = typeof orientationEvent?.requestPermission === "function";
  let listeners = [];
  let callback = null;
  let verificationTimer = null;
  let state = !canOrient ? "unsupported" : permissionCallable ? "permission-required" : "available";
  let requested = false;

  function getSupport() {
    return Object.freeze({
      state,
      secureContext,
      absoluteEvent: hasAbsoluteEvent,
      permissionRequired: permissionCallable,
    });
  }

  async function requestAccess() {
    if (!canOrient) return getSupport();
    if (!permissionCallable) {
      state = "available";
      return getSupport();
    }
    if (requested && state === "permission-denied") return getSupport();
    requested = true;
    try {
      const result = await orientationEvent.requestPermission("absolute");
      if (result !== "granted") {
        state = "permission-denied";
        return getSupport();
      }
      state = "available";
    } catch {
      // Older WebKit implementations accept no argument.
      try {
        const result = await orientationEvent.requestPermission();
        state = result === "granted" ? "available" : "permission-denied";
      } catch {
        state = "error";
      }
    }
    return getSupport();
  }

  function stop() {
    if (verificationTimer !== null) {
      clearTimer(verificationTimer);
      verificationTimer = null;
    }
    for (const { type, handler } of listeners) windowObject?.removeEventListener?.(type, handler);
    listeners = [];
    callback = null;
  }

  function start(listener, onUnavailable) {
    stop();
    if (!canOrient || !["available", "live"].includes(state) || typeof listener !== "function") return false;
    callback = listener;
    let validSamples = 0;
    state = "verifying";
    const handler = (event) => {
      const data = extractDeviceHeading(event, {
        screenAngle: screenObject?.orientation?.angle ?? windowObject?.orientation ?? 0,
      });
      if (data) {
        validSamples += 1;
        if (validSamples < verificationSampleCount) return;
        if (verificationTimer !== null) {
          clearTimer(verificationTimer);
          verificationTimer = null;
        }
        state = "live";
        callback?.(data);
      }
    };
    const types = hasAbsoluteEvent ? ["deviceorientationabsolute", "deviceorientation"] : ["deviceorientation"];
    for (const type of types) {
      windowObject.addEventListener(type, handler, { passive: true });
      listeners.push({ type, handler });
    }
    verificationTimer = setTimer(() => {
      verificationTimer = null;
      state = "unavailable";
      stop();
      onUnavailable?.(getSupport());
    }, verificationTimeoutMs);
    return true;
  }

  function destroy() {
    stop();
  }

  return Object.freeze({ getSupport, requestAccess, start, stop, destroy });
}
