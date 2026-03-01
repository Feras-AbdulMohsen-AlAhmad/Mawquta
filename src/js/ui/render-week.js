function normalizeTime(timeStr) {
  if (typeof timeStr !== "string") return "";
  const trimmed = timeStr.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

// Get day label in Arabic and English from date object
function getDayLabelAR(dateObj) {
  // dateObj is like: { gregorian: { date: "DD-MM-YYYY", weekday: { en: "Monday", ar: "الاثنين" } } ... }

  const ar = dateObj?.gregorian?.weekday?.ar;
  const en = dateObj?.gregorian?.weekday?.en;

  // fallback minimal
  return ar || en || "—";
}

// Get day number from date object
function getDayNumber(dateObj) {
  const day = dateObj?.gregorian?.date; // "DD-MM-YYYY"

  if (!day) return "";

  return day.slice(0, 2); // "DD"
}

// Render a week preview inside a container element
export function renderWeekPreview(containerEl, weekDays, onDaySelect) {
  if (!containerEl) return;

  containerEl.innerHTML = "";
  let selectedEl = null;

  // Handle empty week case
  if (!Array.isArray(weekDays) || weekDays.length === 0) {
    containerEl.innerHTML = `<div class="text-muted small">لا توجد بيانات للأسبوع.</div>`;
    return;
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const todayStr = `${dd}-${mm}-${yyyy}`;

  // Render each day card
  for (const day of weekDays) {
    const dayLabel = getDayLabelAR(day.date);
    const dayNum = getDayNumber(day.date);

    // Normalize prayer times
    const fajr = normalizeTime(day.timings?.Fajr);
    const dhuhr = normalizeTime(day.timings?.Dhuhr);
    const asr = normalizeTime(day.timings?.Asr);
    const maghrib = normalizeTime(day.timings?.Maghrib);
    const isha = normalizeTime(day.timings?.Isha);

    const apiDateStr = day?.date?.gregorian?.date; // "DD-MM-YYYY"
    const isToday = apiDateStr === todayStr;

    const card = document.createElement("div");
    card.className = "card p-2 flex-shrink-0";
    if (isToday) {
      card.classList.add("week-today");
      selectedEl = card;
    }

    // Auto-select today
    if (isToday) {
      card.classList.add("week-selected");
      selectedEl = card;
    }
    card.style.minWidth = "170px";

    card.innerHTML = `
  <div class="d-flex align-items-center justify-content-between mb-1">
    <div class="fw-semibold">${dayLabel}</div>
    <div class="text-muted small">${dayNum}</div>
  </div>

  <div class="d-flex justify-content-between small">
    <span class="text-muted">الفجر</span>
    <span class="fw-semibold">${fajr || "—"}</span>
  </div>
  <div class="d-flex justify-content-between small">
    <span class="text-muted">الظهر</span>
    <span class="fw-semibold">${dhuhr || "—"}</span>
  </div>
  <div class="d-flex justify-content-between small">
    <span class="text-muted">العصر</span>
    <span class="fw-semibold">${asr || "—"}</span>
  </div>
  <div class="d-flex justify-content-between small">
    <span class="text-muted">المغرب</span>
    <span class="fw-semibold">${maghrib || "—"}</span>
  </div>
  <div class="d-flex justify-content-between small">
    <span class="text-muted">العشاء</span>
    <span class="fw-semibold">${isha || "—"}</span>
  </div>
`;

    // Make card clickable
    card.style.cursor = "pointer";

    card.addEventListener("click", () => {
      if (selectedEl) selectedEl.classList.remove("week-selected");
      card.classList.add("week-selected");
      selectedEl = card;

      if (typeof onDaySelect === "function") {
        onDaySelect(day);
      }
    });

    containerEl.appendChild(card);
  }
}
