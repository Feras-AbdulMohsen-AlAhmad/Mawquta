import { renderSectionHeadChip } from "../../../shared/components/section/section-head-chip.component.js";

export function renderDailyPrayerSectionHead({
  cityName,
  statusLabel,
  eyebrowText = "في مدينتك الآن",
}) {
  return `
    <div class="section-head daily-prayer-section__head">
      <div class="section-city daily-prayer-section__city section-head__main">
        ${renderSectionHeadChip({
          tagName: "div",
          rootClassName: "section-city__eyebrow daily-prayer-section__eyebrow",
          text: eyebrowText,
          iconType: "decorative",
          iconClassName: "section-city__eyebrow-icon daily-prayer-section__eyebrow-icon",
        })}
        <h2 class="section-city__name daily-prayer-section__name section-head__title" data-daily-city>${cityName}</h2>
        <span class="section-city__meta daily-prayer-section__meta section-head__meta">
          <span class="daily-prayer-section__meta-value">${statusLabel}</span>
          <span class="daily-prayer-section__meta-prefix">الحالة:</span>
        </span>
      </div>
      <span class="section-badge daily-prayer-section__badge section-head__badge"><span class="daily-prayer-section__badge-label">اليومية</span></span>
    </div>
  `;
}
