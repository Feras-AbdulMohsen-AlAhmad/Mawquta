// src/js/ui/render-countdown.js

let timerId = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatHMS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function renderNextPrayerCountdown(containerEl, nextPrayer, onComplete) {
  if (!containerEl) return;

  // Stop any previous timer (avoid duplicates)
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  // Initial render skeleton
  containerEl.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <div class="fw-semibold" id="npLabel">—</div>
        <div class="text-muted small" id="npTime">—</div>
      </div>
      <div class="fs-5 fw-semibold" id="npCountdown">00:00:00</div>
    </div>
  `;

  const elLabel = containerEl.querySelector("#npLabel");
  const elTime = containerEl.querySelector("#npTime");
  const elCountdown = containerEl.querySelector("#npCountdown");

  if (!nextPrayer) {
    elLabel.textContent = "لا توجد بيانات";
    elTime.textContent = "—";
    elCountdown.textContent = "00:00:00";
    return;
  }

  elLabel.textContent = `الصلاة القادمة: ${nextPrayer.label}`;
  elTime.textContent = `الوقت: ${nextPrayer.time}`;

  let remainingMs = nextPrayer.remainingMs;

  // First paint
  elCountdown.textContent = formatHMS(remainingMs);

  // Tick every 1s
  timerId = setInterval(() => {
    remainingMs -= 1000;

    if (remainingMs <= 0) {
      elCountdown.textContent = "00:00:00";
      clearInterval(timerId);
      timerId = null;

      if (typeof onComplete === "function") onComplete();
      return;
    }

    elCountdown.textContent = formatHMS(remainingMs);
  }, 1000);
}

export function stopNextPrayerCountdown() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}
