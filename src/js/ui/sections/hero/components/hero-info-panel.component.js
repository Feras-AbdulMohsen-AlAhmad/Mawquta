import { renderSectionHeadChip } from "../../../shared/components/section/section-head-chip.component.js";

function renderHeroLocationChip() {
  return renderSectionHeadChip({
    tagName: "div",
    rootClassName: "hero-location-chip",
    rootAttributes: {
      "aria-label": "الموقع المختار",
    },
    text: "دمشق، سوريا",
    textClassName: "hero-location-chip__text",
    textAttributes: {
      "data-hero-location": true,
      "data-global-location-display": true,
    },
    iconType: "image",
    iconClassName: "hero-location-chip__icon",
    iconSrc: "./assets/icons/shared/location-pin.svg",
    iconAlt: "",
  });
}

function renderHeroVerseBlock() {
  return `
    <div class="hero-verse-wrap" aria-label="آية قرآنية">
      <span class="hero-verse__ornament hero-verse__ornament--right" aria-hidden="true"></span>
      <p class="hero-verse" data-hero-verse>إن الصلاة كانت على المؤمنين كتابا موقوتا</p>
      <span class="hero-verse__ornament hero-verse__ornament--left" aria-hidden="true"></span>
    </div>
  `;
}

function renderHeroDateCard() {
  return `
    <article class="date-card" aria-label="التاريخ">
      <div class="date-card__head">
        <span class="date-card__head-label">اليوم</span>
        <span class="date-card__cal" aria-hidden="true"></span>
      </div>

      <p class="date-card__day" data-hero-day-label>—</p>
      <div class="date-card__row" data-hero-hijri-date>—</div>
      <div class="date-card__row" data-hero-gregorian-date>—</div>
    </article>
  `;
}

function renderHeroChangeCityButton() {
  return `
    <button
      type="button"
      class="hero-cta"
      data-hero-change-city
      data-global-location-control
      data-bs-toggle="modal"
      data-bs-target="#qiblaCityModal"
      aria-controls="qiblaCityModal"
    >
      تحديد مدينة أخرى
    </button>
  `;
}

export function renderHeroInfoPanel() {
  return `
    <div class="hero-right">
      ${renderHeroLocationChip()}
      ${renderHeroVerseBlock()}
      ${renderHeroDateCard()}
      ${renderHeroChangeCityButton()}
    </div>
  `;
}

