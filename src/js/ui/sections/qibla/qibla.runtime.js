import { buildQiblaLocationKey } from "../../../services/qibla.service.js";
import { createDeviceHeadingService } from "../../../services/device-heading.service.js";
import { normalize360, shortestSignedAngle, smoothCircularAngle } from "../../../utils/qibla.util.js";
import { renderFeedbackState } from "../../shared/feedback/feedback.js";

const ALIGNMENT_TOLERANCE = 3;
const NEAR_TOLERANCE = 10;
const SMOOTHING_FACTOR = 0.24;

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
  if (accuracy <= 15) return "دقة البوصلة جيدة";
  if (accuracy <= 30) return "دقة البوصلة متوسطة";
  return "دقة البوصلة منخفضة";
}

export function createQiblaRuntime(options = {}) {
  const { rootElement, locationService, qiblaService, formatLocation = defaultFormatLocation } = options;
  if (!rootElement || !locationService || !qiblaService) return Object.freeze({ destroy() {} });

  const headingService = options.headingService ?? createDeviceHeadingService();
  const elements = {
    city: rootElement.querySelector("[data-qibla-city]"), status: rootElement.querySelector("[data-qibla-status]"),
    degree: rootElement.querySelector("[data-qibla-deg]"), data: rootElement.querySelector("[data-qibla-data]"),
    compass: rootElement.querySelector("[data-qibla-compass]"), arrow: rootElement.querySelector("[data-qibla-arrow]"),
    dial: rootElement.querySelector("[data-qibla-dial]"), enable: rootElement.querySelector("[data-qibla-heading-enable]"),
    guidance: rootElement.querySelector("[data-qibla-guidance]"), sensorStatus: rootElement.querySelector("[data-qibla-heading-status]"),
    accuracy: rootElement.querySelector("[data-qibla-accuracy]"),
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
    elements.compass?.setAttribute("aria-label", `اتجاه القبلة ${state.contract.displayDegrees}. ${delta > 0 ? "القبلة على يمين اتجاه الهاتف" : "القبلة على يسار اتجاه الهاتف"} بـ ${Math.round(Math.abs(delta))} درجة.`);
    elements.dial && (elements.dial.style.transform = `rotate(${-heading}deg)`);
    elements.arrow && (elements.arrow.style.transform = `rotate(${delta}deg)`);
    elements.compass?.setAttribute("data-qibla-aligned", Math.abs(delta) <= ALIGNMENT_TOLERANCE && !accuracyLow ? "true" : "false");
    if (elements.accuracy) { elements.accuracy.hidden = false; setText(elements.accuracy, `${accuracyLabel(data.accuracy)}${accuracyLow ? " — أبعد الهاتف عن المعادن وحاول مرة أخرى." : ""}`); }
    let guidance;
    if (accuracyLow && Math.abs(delta) <= ALIGNMENT_TOLERANCE) guidance = "الاتجاه قريب من القبلة — دقة البوصلة منخفضة";
    else if (Math.abs(delta) <= ALIGNMENT_TOLERANCE) guidance = "✓ أنت الآن باتجاه القبلة";
    else if (Math.abs(delta) <= NEAR_TOLERANCE) guidance = `اقتربت من اتجاه القبلة — تبقى ${Math.round(Math.abs(delta))}°`;
    else guidance = `لف الهاتف ${Math.round(Math.abs(delta))}° إلى ${delta > 0 ? "اليمين" : "اليسار"}`;
    if (guidance !== lastGuidance) { setText(elements.guidance, guidance); lastGuidance = guidance; announce(`اتجاه القبلة ${state.contract.displayDegrees}. ${guidance}`); }
  }
  function startHeading() {
    if (!headingService.start((data) => renderHeading(data))) { headingState = "unavailable"; updateSensorUI(); staticVisual(state.contract); }
  }
  async function enableHeading() {
    if (requesting || destroyed) return;
    requesting = true; headingState = "requesting"; updateSensorUI();
    const result = await headingService.requestAccess();
    requesting = false; headingState = result?.state ?? headingService.getSupport?.().state ?? "error"; updateSensorUI();
    if (headingState === "available") { startHeading(); setText(elements.sensorStatus, "بوصلة الجهاز مفعلة — حرّك الهاتف للتوجيه"); }
    else if (headingState === "permission-denied") { setText(elements.sensorStatus, "تعذر تفعيل البوصلة. يمكنك استخدام الاتجاه الثابت."); staticVisual(state.contract); }
  }
  function getStatusText() {
    if (state.status === "success") return "اتجاه القبلة محسوب من موقعك الحالي";
    if (state.status === "empty") return "لا توجد بيانات";
    if (state.status === "error") return state.contract ? "تعذر التحديث" : "تعذر الحساب";
    return state.contract ? "جارٍ التحديث…" : "جارٍ الحساب…";
  }
  function applyState() {
    setText(elements.city, state.location ? formatLocation(state.location) : "دمشق، سوريا");
    setText(elements.status, getStatusText());
    if (state.status === "success" && state.contract) { setText(elements.degree, state.contract.displayDegrees); elements.data.innerHTML = ""; headingState === "live" ? renderHeading({ heading: smoothedHeading, isReliable: true, accuracy: null }) : staticVisual(state.contract); return; }
    if (state.contract) return;
    setText(elements.degree, "--°"); elements.data.innerHTML = state.status === "empty" ? renderQiblaEmptyState() : state.status === "error" ? renderQiblaErrorState() : renderQiblaLoadingState();
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
