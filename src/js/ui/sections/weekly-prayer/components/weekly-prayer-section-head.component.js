import { renderSectionHeadChip } from "../../../shared/components/section/section-head-chip.component.js";

export function renderWeeklyPrayerSectionHead({
  cityName,
  metaText,
  eyebrowText = "مواقيت الصلاة في",
}) {
  return `
    <div class="section-head weekly-prayer-section__head">
      <div class="section-city weekly-prayer-section__city section-head__main">
        ${renderSectionHeadChip({
          tagName: "div",
          rootClassName: "section-city__eyebrow weekly-prayer-section__eyebrow",
          text: eyebrowText,
          iconType: "decorative",
          iconClassName: "section-city__eyebrow-icon weekly-prayer-section__eyebrow-icon",
        })}
        <h2 class="section-city__name weekly-prayer-section__name section-head__title" data-weekly-city>${cityName}</h2>
        <span class="section-city__meta weekly-prayer-section__meta section-head__meta">${metaText}</span>
      </div>
      <span class="section-badge weekly-prayer-section__badge section-head__badge"><span class="weekly-prayer-section__badge-label">الاسبوعية</span></span>
    </div>
  `;
}
