// src/js/ui/sections/qibla/qibla.runtime.js
// Orchestrates live Qibla data: subscribes to the location service, resolves
// coordinates through the injected Qibla service (existing coords / curated
// default Damascus / one deduped geocode lookup), computes the local bearing
// and re-renders the Qibla degree, city readout and arrow.
//
// The runtime never requests a browser location fix itself and never registers
// a device-orientation listener. The Qibla service is injected so this module
// stays Node-testable.

import { buildQiblaLocationKey } from "../../../services/qibla.service.js";
import { renderFeedbackState } from "../../shared/feedback/feedback.js";

function defaultFormatLocation(location) {
  if (!location) return "الموقع غير محدد";

  if (location.city === "Damascus" && location.country === "Syria") {
    return "دمشق، سوريا";
  }

  return `${location.city}، ${location.country}`;
}

const renderQiblaLoadingState = () => renderFeedbackState({ type: "loading", className: "qibla-loading", message: "جارٍ حساب اتجاه القبلة…", ariaLabel: "جارٍ حساب اتجاه القبلة" });
const renderQiblaEmptyState = () => renderFeedbackState({ type: "empty", className: "qibla-empty", message: "لا تتوفر بيانات لحساب اتجاه القبلة حالياً." });
const renderQiblaErrorState = () => renderFeedbackState({ type: "error", className: "qibla-error", message: "تعذر حساب اتجاه القبلة.", retryAttribute: "qibla-retry" });

export function createQiblaRuntime(options = {}) {
  const {
    rootElement,
    locationService,
    qiblaService,
    formatLocation = defaultFormatLocation,
  } = options;

  let sequence = 0;
  let loadKey = null;
  let attemptKey = null;
  let pendingKey = null;
  let unsubscribe = null;
  let retryBound = false;

  const state = {
    status: "idle",
    contract: null,
    location: null,
  };

  function getElements() {
    return {
      cityElement: rootElement?.querySelector("[data-qibla-city]"),
      statusElement: rootElement?.querySelector("[data-qibla-status]"),
      degreeElement: rootElement?.querySelector("[data-qibla-deg]"),
      dataElement: rootElement?.querySelector("[data-qibla-data]"),
      compassElement: rootElement?.querySelector("[data-qibla-compass]"),
      arrowElement: rootElement?.querySelector("[data-qibla-arrow]"),
    };
  }

  function getStatusText() {
    switch (state.status) {
      case "success":
        return "اتجاه القبلة محسوب من موقعك الحالي";
      case "empty":
        return "لا توجد بيانات";
      case "error":
        return state.contract ? "تعذر التحديث" : "تعذر الحساب";
      case "stale":
      case "loading":
      default:
        return state.contract ? "جارٍ التحديث…" : "جارٍ الحساب…";
    }
  }

  function updateCompass(contract) {
    const { compassElement, arrowElement } = getElements();
    if (!compassElement) return;

    if (contract) {
      compassElement.setAttribute(
        "aria-label",
        `اتجاه القبلة بزاوية ${contract.displayDegrees}`,
      );
      if (arrowElement) {
        arrowElement.style.transform = `rotate(${contract.compassRotation}deg)`;
      }
      return;
    }

    compassElement.setAttribute("aria-label", "اتجاه القبلة");
    if (arrowElement) {
      arrowElement.style.transform = "";
    }
  }

  function applyState() {
    const {
      cityElement,
      statusElement,
      degreeElement,
      dataElement,
    } = getElements();
    if (!cityElement || !statusElement || !degreeElement || !dataElement) {
      return;
    }

    cityElement.textContent = state.location
      ? formatLocation(state.location)
      : "دمشق، سوريا";
    statusElement.textContent = getStatusText();

    const hasData = Boolean(state.contract);

    if (state.status === "success" && state.contract) {
      degreeElement.textContent = state.contract.displayDegrees;
      updateCompass(state.contract);
      dataElement.innerHTML = "";
      return;
    }

    if (hasData) {
      // stale / error / empty while valid same-location data is present:
      // keep the compass untouched and only surface the status in the head.
      return;
    }

    degreeElement.textContent = "--°";
    updateCompass(null);

    if (state.status === "empty") {
      dataElement.innerHTML = renderQiblaEmptyState();
    } else if (state.status === "error") {
      dataElement.innerHTML = renderQiblaErrorState();
    } else {
      dataElement.innerHTML = renderQiblaLoadingState();
    }
  }

  function buildLoadKey(location) {
    return buildQiblaLocationKey(location);
  }

  async function load(location, { force = false } = {}) {
    const key = buildLoadKey(location);

    if (!force) {
      if (key === loadKey && state.contract) return;
      if (key === pendingKey) return;
      if (key === attemptKey && state.status === "error") return;
    }

    const token = ++sequence;
    attemptKey = key;
    pendingKey = key;
    state.location = location;
    state.status = state.contract ? "stale" : "loading";
    applyState();

    try {
      const contract = await qiblaService.getByLocation(location);

      if (token !== sequence) return;

      if (
        !contract ||
        typeof contract !== "object" ||
        !Number.isFinite(contract.qiblaBearing)
      ) {
        state.status = "empty";
        if (!state.contract) loadKey = null;
        applyState();
        return;
      }

      if (token !== sequence) return;

      state.status = "success";
      state.contract = contract;
      state.location = location;
      loadKey = key;
      applyState();
    } catch (error) {
      if (token !== sequence) return;

      state.status = "error";
      applyState();
    } finally {
      if (token === sequence) pendingKey = null;
    }
  }

  function onLocationState(locationState) {
    if (locationState?.phase !== "ready" || !locationState?.location) {
      if (!state.location) {
        state.status = "idle";
        applyState();
      }
      return;
    }

    const location = locationState.location;
    const nextLocationKey = buildQiblaLocationKey(location);
    const previousLocationKey = state.location
      ? buildQiblaLocationKey(state.location)
      : null;

    state.location = location;

    // Never keep previous-location data when the location key changes.
    if (
      previousLocationKey !== null &&
      previousLocationKey !== nextLocationKey
    ) {
      state.contract = null;
      loadKey = null;
    }

    void load(location);
  }

  function bindRetry() {
    if (retryBound || !rootElement) return;
    retryBound = true;

    rootElement.addEventListener("click", (event) => {
      if (!event.target?.closest?.("[data-qibla-retry]")) return;
      if (state.location) void load(state.location, { force: true });
    });
  }

  function destroy() {
    sequence += 1;
    pendingKey = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  if (!rootElement || !locationService || !qiblaService) {
    return Object.freeze({ destroy: () => {} });
  }

  bindRetry();
  unsubscribe = locationService.subscribe(onLocationState);

  return Object.freeze({ destroy });
}
