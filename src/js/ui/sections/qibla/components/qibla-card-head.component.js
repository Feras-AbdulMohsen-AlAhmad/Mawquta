export function renderQiblaCardHead(
  modalId,
  {
    cityName = "دمشق، سوريا",
  } = {},
) {
  return `
    <div class="qibla-card__head section-head">
      <div class="qibla-card__heading section-head__main">
        <h2 class="qibla-card__title section-head__title">
          <span class="qibla-card__title-icon section-head__icon" aria-hidden="true"></span>
          <span>اتجاه القبلة</span>
        </h2>
        <div class="qibla-card__location-row">
          <p
            class="qibla-card__location section-head__meta"
            data-qibla-city
            data-global-location-display
          >${cityName}</p>
        </div>
      </div>
    </div>
  `;
}
