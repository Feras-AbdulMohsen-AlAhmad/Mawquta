const DEFAULT_COUNTDOWN_PARTS = [
  { value: "--", unit: "Hr", valueDataAttribute: "data-hero-countdown-hours" },
  { value: "--", unit: "Min", valueDataAttribute: "data-hero-countdown-minutes" },
  { value: "--", unit: "Sec", valueDataAttribute: "data-hero-countdown-seconds" },
];

function renderCountdownPart(part) {
  return `
    <div class="hero-countdown__item">
      <span class="hero-countdown__value" ${part.valueDataAttribute}>${part.value}</span>
      <span class="hero-countdown__unit">${part.unit}</span>
    </div>
  `;
}

export function renderHeroCountdown() {
  return `
    <section class="hero-countdown" aria-label="الوقت المتبقي للصلاة القادمة">
      <p class="hero-countdown__label" data-hero-countdown-label>الوقت المتبقي</p>

      <div class="hero-countdown__grid" data-hero-countdown>
        ${DEFAULT_COUNTDOWN_PARTS.map((part, index) => {
          const partMarkup = renderCountdownPart(part);
          const separatorMarkup =
            index < DEFAULT_COUNTDOWN_PARTS.length - 1
              ? '<span class="hero-countdown__separator" aria-hidden="true">:</span>'
              : "";

          return `${partMarkup}${separatorMarkup}`;
        }).join("\n")}
      </div>

      <span class="visually-hidden" data-hero-live-status aria-live="polite"></span>
    </section>
  `;
}

