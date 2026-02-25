// Holds the single active countdown interval for the whole module.
// Using one shared timer prevents multiple intervals from stacking up.
let timerId = null;

/**
 * Pads a number to 2 digits.
 * Example: 4 -> "04"
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Formats milliseconds into "HH:MM:SS".
 * Ensures the value never goes below zero.
 */
function formatHMS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/**
 * Stops the current countdown interval (if any) and resets timerId.
 * This is critical to avoid duplicate timers when re-rendering.
 */
function clearCountdownTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

/**
 * Renders the "Next Prayer" card and starts a 1-second countdown.
 *
 * - containerEl: the DOM element where the countdown UI should render.
 * - nextPrayer: object containing label/time/remainingMs.
 * - onComplete: callback fired when the countdown reaches zero.
 */
export function renderNextPrayerCountdown(containerEl, nextPrayer, onComplete) {
  if (!containerEl) return;

  // Always stop any previous timer before starting a new one.
  // This prevents the countdown from speeding up after multiple refreshes.
  clearCountdownTimer();

  // Render the UI skeleton (static layout).
  containerEl.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <div class="fw-semibold" id="npLabel">—</div>
        <div class="text-muted small" id="npTime">—</div>
      </div>
      <div class="fs-5 fw-semibold" id="npCountdown">00:00:00</div>
    </div>
  `;

  // Grab references to the elements we will update.
  const elLabel = containerEl.querySelector("#npLabel");
  const elTime = containerEl.querySelector("#npTime");
  const elCountdown = containerEl.querySelector("#npCountdown");

  // If no nextPrayer data is provided, show a safe fallback state.
  if (!nextPrayer) {
    elLabel.textContent = "لا توجد بيانات";
    elTime.textContent = "—";
    elCountdown.textContent = "00:00:00";
    return;
  }

  // Fill the label/time once (static text).
  elLabel.textContent = `الصلاة القادمة: ${nextPrayer.label}`;
  elTime.textContent = `الوقت: ${nextPrayer.time}`;

  // Remaining time in milliseconds; normalize/guard against invalid values.
  let remainingMs = Number(nextPrayer.remainingMs);
  if (!Number.isFinite(remainingMs) || remainingMs < 0) {
    remainingMs = 0;
  }

  // First paint (immediate render) before the interval starts.
  elCountdown.textContent = formatHMS(remainingMs);

  // Start ticking every 1000ms.
  timerId = setInterval(() => {
    remainingMs -= 1000;

    // When we reach zero (or below), stop the timer and call onComplete.
    if (remainingMs <= 0) {
      elCountdown.textContent = "00:00:00";
      clearCountdownTimer();

      if (typeof onComplete === "function") onComplete();
      return;
    }

    // Update the displayed countdown.
    elCountdown.textContent = formatHMS(remainingMs);
  }, 1000);
}

/**
 * Public helper to stop the countdown from outside this module.
 * Useful if you ever need to manually cancel the timer on navigation.
 */
export function stopNextPrayerCountdown() {
  clearCountdownTimer();
}
