const QIBLA_ICON_PATHS = {
  decorLeft: "./assets/icons/sections/qibla/qibla-left-sujud.svg",
  compass: "./assets/icons/sections/qibla/qibla-compass.svg",
  decorRight: "./assets/icons/sections/qibla/qibla-right-tasbee.svg",
};

const QIBLA_ARROW_SVG = `
  <svg
    width="28"
    height="44"
    viewBox="0 0 28 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M14 2L26 42L14 33L2 42L14 2Z"
      fill="#DD9730"
      stroke="#7A6D79"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </svg>
`;

export function renderQiblaVisual() {
  return `
    <div class="qibla-visual" data-qibla-visual>
      <img
        class="qibla-visual__decor qibla-visual__decor--left"
        src="${QIBLA_ICON_PATHS.decorLeft}"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />

      <div class="qibla-compass-stage">
        <div class="qibla-compass" role="img" data-qibla-compass aria-label="اتجاه القبلة">
          <div class="qibla-compass__dial-rotator" data-qibla-dial>
            <img class="qibla-compass__asset" src="${QIBLA_ICON_PATHS.compass}" aria-hidden="true" alt="" loading="lazy" decoding="async" />
          </div>
          <span class="qibla-compass__needle" data-qibla-arrow aria-hidden="true">${QIBLA_ARROW_SVG}</span>
          <span class="qibla-compass__forward-marker" aria-hidden="true">▲<small>أعلى الهاتف</small></span>
          <span class="qibla-compass__center" aria-hidden="true"></span>
        </div>
      </div>

      <div class="qibla-compass__controls" data-qibla-controls>
        <button type="button" class="qibla-compass__enable" data-qibla-heading-enable>تفعيل بوصلة الجهاز</button>
        <p class="qibla-compass__guidance" data-qibla-guidance>اتجاه القبلة من الشمال</p>
        <p class="qibla-compass__sensor-status" data-qibla-heading-status>البوصلة الثابتة متاحة</p>
        <p class="qibla-compass__accuracy" data-qibla-accuracy hidden></p>
      </div>

      <img
        class="qibla-visual__decor qibla-visual__decor--right"
        src="${QIBLA_ICON_PATHS.decorRight}"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    </div>
  `;
}
