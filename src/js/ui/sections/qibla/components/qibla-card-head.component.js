export function renderQiblaCardHead(
  modalId,
  {
    cityName = "دمشق، سوريا",
    statusLabel = "جارٍ الحساب…",
    displayDegrees = "--°",
  } = {},
) {
  return `
    <div class="qibla-card__head section-head">
      <div class="qibla-card__heading section-head__main">
        <h2 class="qibla-card__title section-head__title">
          <span class="qibla-card__title-icon section-head__icon" aria-hidden="true"></span>
          <span>اتجاه القبلة من موقعك الحالي</span>
        </h2>
        <div class="qibla-card__location-row">
          <p
            class="qibla-card__location section-head__meta"
            data-qibla-city
            data-global-location-display
          >${cityName}</p>
        </div>
        <p class="qibla-card__status section-head__meta" data-qibla-status>${statusLabel}</p>
      </div>

      <p class="qibla-card__degree section-head__aux" data-qibla-deg>${displayDegrees}</p>
    </div>
  `;
}
