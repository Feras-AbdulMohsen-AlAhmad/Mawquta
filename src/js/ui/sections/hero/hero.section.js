import { renderHeroDecorations } from "./components/hero-decorations.component.js";
import { renderHeroNextPrayerCard } from "./components/hero-next-prayer-card.component.js";
import { renderHeroInfoPanel } from "./components/hero-info-panel.component.js";
import { renderSectionDivider } from "../../shared/components/section/section-divider.component.js";

const HERO_NEXT_PRAYER_BACKGROUNDS = Object.freeze({
  fajr: new URL(
    "../../../../assets/illustrations/hero/next-prayer/fajr-background.png",
    import.meta.url,
  ).href,
  dhuhr: new URL(
    "../../../../assets/illustrations/hero/next-prayer/dhuhr-background.png",
    import.meta.url,
  ).href,
  asr: new URL(
    "../../../../assets/illustrations/hero/next-prayer/asr-background.png",
    import.meta.url,
  ).href,
  maghrib: new URL(
    "../../../../assets/illustrations/hero/next-prayer/maghrib-background.png",
    import.meta.url,
  ).href,
  isha: new URL(
    "../../../../assets/illustrations/hero/next-prayer/isha-background.png",
    import.meta.url,
  ).href,
});

export function resolveHeroNextPrayerBackground(prayerKey) {
  if (typeof prayerKey !== "string") return null;

  const normalizedKey = prayerKey.trim().toLowerCase();
  const asset = Object.hasOwn(HERO_NEXT_PRAYER_BACKGROUNDS, normalizedKey)
    ? HERO_NEXT_PRAYER_BACKGROUNDS[normalizedKey]
    : null;

  return asset ? { key: normalizedKey, asset } : null;
}

function updateHeroDateRow(rowElement, label) {
  if (!rowElement || label == null) return;

  const normalizedLabel = String(label).trim() || "—";
  const parts = normalizedLabel.split(/\s+/);
  const dayElement = rowElement.querySelector('[data-date-part="day"]');
  const monthElement = rowElement.querySelector('[data-date-part="month"]');
  const yearElement = rowElement.querySelector('[data-date-part="year"]');

  if (!dayElement || !monthElement || !yearElement) {
    rowElement.textContent = normalizedLabel;
    return;
  }

  const hasCompleteDate = parts.length >= 3 && normalizedLabel !== "—";
  dayElement.textContent = hasCompleteDate ? parts[0] : normalizedLabel;
  monthElement.textContent = hasCompleteDate ? parts.slice(1, -1).join(" ") : "";
  yearElement.textContent = hasCompleteDate ? parts.at(-1) : "";

  if (typeof rowElement.setAttribute === "function") {
    rowElement.setAttribute("aria-label", normalizedLabel);
  }
}

export function renderHeroSection(rootElement, sectionData = {}) {
  void sectionData;

  if (!rootElement) {
    return null;
  }

  rootElement.innerHTML = `
    <section class="hero" id="hero" aria-label="قسم البطل">
      ${renderHeroDecorations()}

      <div class="hero__inner">
        <div class="hero__layout">
          <div class="hero__pane hero__pane--card">
            <div class="hero-left">
              ${renderHeroNextPrayerCard()}
            </div>
          </div>

          <div class="hero__pane hero__pane--content">
            ${renderHeroInfoPanel()}
          </div>
        </div>
      </div>
    </section>

    ${renderSectionDivider()}
  `;

  return rootElement;
}

/**
 * Updates the live state of the hero next-prayer card and countdown.
 * The hero consumes the Daily contract only; it never fetches on its own.
 *
 * Accepted updates:
 * - nextPrayerKey   (string)  -> prayer-specific card background
 * - nextPrayerLabel (string)  -> [data-hero-next-prayer-label]
 * - nextPrayerTime  (string)  -> [data-hero-next-prayer-time]  (HH:MM)
 * - hours/minutes/seconds     -> the three [data-hero-countdown-*] values
 * - dayLabel        (string)  -> [data-hero-day-label]
 * - hijriDate       (string)  -> [data-hero-hijri-date]
 * - gregorianDate   (string)  -> [data-hero-gregorian-date]
 */
export function updateHeroSectionLiveState(rootElement, updates = {}) {
  if (!rootElement) {
    return null;
  }

  const {
    nextPrayerKey,
    nextPrayerLabel,
    nextPrayerTime,
    hours,
    minutes,
    seconds,
    dayLabel,
    hijriDate,
    gregorianDate,
  } = updates;

  const cardEl = rootElement.querySelector("[data-hero-next-prayer-card]");
  const timeEl = rootElement.querySelector("[data-hero-next-prayer-time]");
  const labelEl = rootElement.querySelector("[data-hero-next-prayer-label]");
  const hoursEl = rootElement.querySelector("[data-hero-countdown-hours]");
  const minutesEl = rootElement.querySelector("[data-hero-countdown-minutes]");
  const secondsEl = rootElement.querySelector("[data-hero-countdown-seconds]");
  const dayLabelEl = rootElement.querySelector("[data-hero-day-label]");
  const hijriDateEl = rootElement.querySelector("[data-hero-hijri-date]");
  const gregorianDateEl = rootElement.querySelector("[data-hero-gregorian-date]");
  const liveStatusEl = rootElement.querySelector("[data-hero-live-status]");

  if (cardEl && Object.hasOwn(updates, "nextPrayerKey")) {
    const background = resolveHeroNextPrayerBackground(nextPrayerKey);
    cardEl.dataset.nextPrayer = background?.key ?? "";

    if (background) {
      cardEl.style.setProperty(
        "--hero-next-prayer-background-image",
        `url("${background.asset}")`,
      );
    } else {
      cardEl.style.removeProperty("--hero-next-prayer-background-image");
    }
  }
  if (timeEl && nextPrayerTime != null) timeEl.textContent = nextPrayerTime;
  if (labelEl && nextPrayerLabel != null) labelEl.textContent = nextPrayerLabel;
  if (hoursEl && hours != null) hoursEl.textContent = hours;
  if (minutesEl && minutes != null) minutesEl.textContent = minutes;
  if (secondsEl && seconds != null) secondsEl.textContent = seconds;
  if (dayLabelEl && dayLabel != null) dayLabelEl.textContent = dayLabel;
  updateHeroDateRow(hijriDateEl, hijriDate);
  updateHeroDateRow(gregorianDateEl, gregorianDate);

  // Announce only meaningful next-prayer transitions through the visually
  // hidden polite live region. Placeholder ("—") and repeat labels are never
  // re-announced, so the per-second countdown stays silent for assistive tech.
  if (liveStatusEl && nextPrayerLabel != null && nextPrayerLabel !== "—") {
    const liveMessage = `الصلاة القادمة: ${nextPrayerLabel}`;
    if (liveStatusEl.textContent !== liveMessage) {
      liveStatusEl.textContent = liveMessage;
    }
  }

  return rootElement;
}
