import { buildQiblaLocationKey } from "../../../services/qibla.service.js";
import { createDeviceHeadingService } from "../../../services/device-heading.service.js";
import { normalize360, shortestSignedAngle, smoothCircularAngle } from "../../../utils/qibla.util.js";
import { createToastController, renderFeedbackState } from "../../shared/feedback/feedback.js";

const ALIGNMENT_TOLERANCE = 3;
const NEAR_TOLERANCE = 10;
const SMOOTHING_FACTOR = 0.24;
const UNSUPPORTED_DEVICE_MESSAGE = "البوصلة غير مدعومة على هذا الجهاز. استخدم هاتفًا أو جهازًا لوحيًا يدعم مستشعرات الاتجاه لتفعيلها.";

const renderQiblaLoadingState = () => renderFeedbackState({ type: "loading", className: "qibla-loading", message: "جارٍ حساب اتجاه القبلة…", ariaLabel: "جارٍ حساب اتجاه القبلة" });
const renderQiblaEmptyState = () => renderFeedbackState({ type: "empty", className: "qibla-empty", message: "لا تتوفر بيانات لحساب اتجاه القبلة حالياً." });
const renderQiblaErrorState = () => renderFeedbackState({ type: "error", className: "qibla-error", message: "تعذر حساب اتجاه القبلة.", retryAttribute: "qibla-retry" });

function defaultFormatLocation(location) {
  if (!location) return "الموقع غير محدد";
  if (location.city === "Damascus" && location.country === "Syria") return "دمشق، سوريا";
  return `${location.city}، ${location.country}`;
}

function accuracyLabel(accuracy) {
  if (!Number.isFinite(accuracy)) return "دقة البوصلة غير متاحة";
  if (accuracy <= 10) return "دقة البوصلة جيدة";
  if (accuracy <= 20) return "دقة البوصلة متوسطة";
  return "دقة البوصلة منخفضة";
}

export function isPortableQiblaDevice(navigatorObject = globalThis.navigator) {
  const userAgent = String(navigatorObject?.userAgent ?? "");
  const platform = String(navigatorObject?.platform ?? "");
  const maxTouchPoints = Number(navigatorObject?.maxTouchPoints ?? 0);
  const reportsMobile = navigatorObject?.userAgentData?.mobile === true;
  const portableUserAgent = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const iPadOSDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  return reportsMobile || portableUserAgent || iPadOSDesktopMode;
}

export function createQiblaRuntime(options = {}) {
  const { rootElement, locationService, qiblaService, formatLocation = defaultFormatLocation } = options;
  if (!rootElement || !locationService || !qiblaService) return Object.freeze({ destroy() {} });

  const headingService = options.headingService ?? createDeviceHeadingService();
  const toastController = options.toastController ?? createToastController();
  const portableDevice = isPortableQiblaDevice(options.navigatorObject ?? globalThis.navigator);
  const elements = {
    city: rootElement.querySelector("[data-qibla-city]"), data: rootElement.querySelector("[data-qibla-data]"),
    compass: rootElement.querySelector("[data-qibla-compass]"), arrow: rootElement.querySelector("[data-qibla-arrow]"),
    dial: rootElement.querySelector("[data-qibla-dial]"), enable: rootElement.querySelector("[data-qibla-heading-enable]"),
    guidance: rootElement.querySelector("[data-qibla-guidance]"), sensorStatus: rootElement.querySelector("[data-qibla-heading-status]"),
    accuracy: rootElement.querySelector("[data-qibla-accuracy]"), controls: rootElement.querySelector("[data-qibla-controls]"),
    unsupported: rootElement.querySelector("[data-qibla-unsupported]"), phoneGuide: rootElement.querySelector("[data-qibla-phone-guide]"),
  };
  let sequence = 0, loadKey = null, attemptKey = null, pendingKey = null, unsubscribe = null, destroyed = false;
  let headingState = headingService.getSupport?.().state ?? "unsupported";
  let requesting = false, smoothedHeading = null, lastGuidance = "", lastAnnouncement = "";
  const state = { status: "idle", contract: null, location: null };

  function setText(element, value) { if (element && element.textContent !== value) element.textContent = value; }
  function announce(value) {
    if (value === lastAnnouncement) return;
    lastAnnouncement = value;
    rootElement.setAttribute?.("aria-label", value);
  }
  function updateSensorUI() {
    if (!portableDevice) {
      headingState = "unsupported-device";
      elements.controls?.setAttribute("data-qibla-device-class", "unsupported");
      if (elements.unsupported) elements.unsupported.hidden = false;
      if (elements.phoneGuide) elements.phoneGuide.hidden = true;
      if (elements.guidance) elements.guidance.hidden = true;
      if (elements.sensorStatus) elements.sensorStatus.hidden = true;
      if (elements.accuracy) elements.accuracy.hidden = true;
      if (elements.enable) {
        elements.enable.hidden = true;
        elements.enable.disabled = false;
        elements.enable.setAttribute("aria-busy", "false");
      }
      return;
    }
    elements.controls?.setAttribute("data-qibla-device-class", "portable");
    if (elements.unsupported) elements.unsupported.hidden = true;
    if (elements.phoneGuide) elements.phoneGuide.hidden = false;
    if (elements.guidance) elements.guidance.hidden = false;
    if (elements.sensorStatus) elements.sensorStatus.hidden = false;
    const support = headingService.getSupport?.() ?? { state: headingState };
    headingState = support.state;
    const unavailable = ["unsupported", "unavailable", "unreliable", "error"].includes(headingState);
    if (elements.enable) {
      elements.enable.hidden = unavailable;
      elements.enable.disabled = requesting;
      elements.enable.setAttribute("aria-busy", requesting ? "true" : "false");
    }
    const labels = { "permission-required": "فعّل البوصلة لتوجيه حي", "permission-denied": "لم يُسمح باستخدام البوصلة", requesting: "جارٍ تفعيل البوصلة…", live: "بوصلة الجهاز مفعلة", available: "البوصلة جاهزة للتفعيل", unsupported: "البوصلة الحية غير متاحة على هذا الجهاز", error: "تعذر تشغيل البوصلة" };
    setText(elements.sensorStatus, labels[headingState] ?? "البوصلة الثابتة متاحة");
  }
  function staticVisual(contract) {
    if (!contract) return;
    elements.compass?.setAttribute("aria-label", `اتجاه القبلة بزاوية ${contract.displayDegrees}`);
    elements.dial && (elements.dial.style.transform = "rotate(0deg)");
    elements.arrow && (elements.arrow.style.transform = `rotate(${contract.qiblaBearing}deg)`);
    elements.compass?.setAttribute("data-qibla-aligned", "false");
    setText(elements.guidance, `اتجاه القبلة ${contract.displayDegrees} من الشمال`);
    announce(`اتجاه القبلة ${contract.displayDegrees} من الشمال`);
  }
  function renderHeading(data) {
    if (destroyed || !state.contract || !data?.isReliable) return;
    const heading = smoothedHeading === null ? data.heading : smoothCircularAngle(smoothedHeading, data.heading, SMOOTHING_FACTOR);
    smoothedHeading = heading;
    const delta = shortestSignedAngle(state.contract.qiblaBearing - heading);
    const accuracyLow = Number.isFinite(data.accuracy) && data.accuracy > 30;
    elements.compass?.setAttribute("aria-label", `اتجاه القبلة. ${delta > 0 ? "القبلة إلى يمين اتجاه الهاتف" : "القبلة إلى يسار اتجاه الهاتف"}. وجّه أعلى الهاتف نحو السهم.`);
    elements.dial && (elements.dial.style.transform = `rotate(${-heading}deg)`);
    elements.arrow && (elements.arrow.style.transform = `rotate(${delta}deg)`);
    elements.compass?.setAttribute("data-qibla-aligned", Math.abs(delta) <= ALIGNMENT_TOLERANCE && !accuracyLow ? "true" : "false");
    if (elements.accuracy) { elements.accuracy.hidden = false; setText(elements.accuracy, `${accuracyLabel(data.accuracy)}${accuracyLow ? " — أبعد الهاتف عن المعادن وحاول مرة أخرى." : ""}`); }
    let guidance;
    if (accuracyLow && Math.abs(delta) <= ALIGNMENT_TOLERANCE) guidance = "الاتجاه قريب من القبلة — دقة البوصلة منخفضة";
    else if (Math.abs(delta) <= ALIGNMENT_TOLERANCE) guidance = "✓ أنت الآن باتجاه القبلة";
    else if (Math.abs(delta) <= NEAR_TOLERANCE) guidance = "اقتربت من اتجاه القبلة — وجّه أعلى الهاتف نحو السهم";
    else guidance = `القبلة إلى ${delta > 0 ? "يمين" : "يسار"} اتجاه الهاتف — وجّه أعلى الهاتف نحو السهم`;
    if (guidance !== lastGuidance) { setText(elements.guidance, guidance); lastGuidance = guidance; announce(`اتجاه القبلة ${state.contract.displayDegrees}. ${guidance}`); }
  }
  function startHeading() {
    if (!headingService.start((data) => renderHeading(data))) { headingState = "unavailable"; updateSensorUI(); staticVisual(state.contract); }
  }
  async function enableHeading() {
    if (requesting || destroyed) return;
    if (!portableDevice) {
      toastController.show("info", UNSUPPORTED_DEVICE_MESSAGE, { key: "qibla-unsupported-device" });
      return;
    }
    requesting = true; headingState = "requesting"; updateSensorUI();
    const result = await headingService.requestAccess();
    requesting = false; headingState = result?.state ?? headingService.getSupport?.().state ?? "error"; updateSensorUI();
    if (headingState === "available") { startHeading(); setText(elements.sensorStatus, "بوصلة الجهاز مفعلة — وجّه أعلى الهاتف نحو السهم"); }
    else if (headingState === "permission-denied") { setText(elements.sensorStatus, "تعذر تفعيل البوصلة. يمكنك استخدام الاتجاه الثابت."); staticVisual(state.contract); }
  }
  function applyState() {
    setText(elements.city, state.location ? formatLocation(state.location) : "دمشق، سوريا");
    if (state.status === "success" && state.contract) { elements.data.innerHTML = ""; headingState === "live" && Number.isFinite(smoothedHeading) ? renderHeading({ heading: smoothedHeading, isReliable: true, accuracy: null }) : staticVisual(state.contract); return; }
    if (state.contract) return;
    elements.data.innerHTML = state.status === "empty" ? renderQiblaEmptyState() : state.status === "error" ? renderQiblaErrorState() : renderQiblaLoadingState();
  }
  async function load(location, { force = false } = {}) {
    const key = buildQiblaLocationKey(location);
    if (!force && ((key === loadKey && state.contract) || key === pendingKey || (key === attemptKey && state.status === "error"))) return;
    const token = ++sequence; attemptKey = key; pendingKey = key; state.location = location; state.status = state.contract ? "stale" : "loading"; applyState();
    try {
      const contract = await qiblaService.getByLocation(location);
      if (token !== sequence) return;
      if (!contract || !Number.isFinite(contract.qiblaBearing)) { state.status = "empty"; applyState(); return; }
      state.status = "success"; state.contract = contract; loadKey = key; applyState();
    } catch { if (token === sequence) { state.status = "error"; applyState(); } }
    finally { if (token === sequence) pendingKey = null; }
  }
  function onLocationState(locationState) {
    if (locationState?.phase !== "ready" || !locationState.location) { if (!state.location) { state.status = "idle"; applyState(); } return; }
    const location = locationState.location; const next = buildQiblaLocationKey(location); const previous = state.location && buildQiblaLocationKey(state.location);
    state.location = location;
    if (previous && previous !== next) { state.contract = null; loadKey = null; }
    void load(location);
  }
  const onClick = (event) => { if (event.target?.closest?.("[data-qibla-retry]")) { if (state.location) void load(state.location, { force: true }); } if (event.target?.closest?.("[data-qibla-heading-enable]")) void enableHeading(); };
  rootElement.addEventListener("click", onClick);
  updateSensorUI();
  unsubscribe = locationService.subscribe(onLocationState);
  return Object.freeze({ destroy() { destroyed = true; sequence += 1; pendingKey = null; unsubscribe?.(); unsubscribe = null; rootElement.removeEventListener?.("click", onClick); headingService.destroy?.(); } });
}
