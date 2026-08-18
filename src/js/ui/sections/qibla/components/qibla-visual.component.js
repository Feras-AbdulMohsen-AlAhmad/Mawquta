const QIBLA_ASSETS = {
  decorLeft: "./assets/illustrations/qibla/qibla-sujud-illustration.svg",
  decorRight: "./assets/illustrations/qibla/qibla-tasbih-illustration.svg",
};

function point(cx, cy, radius, degrees) {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function tick(degrees) {
  const major = degrees % 30 === 0;
  const [x1, y1] = point(200, 200, major ? 174 : 180, degrees);
  const [x2, y2] = point(200, 200, 185, degrees);
  const className = major ? " qibla-tick--major" : "";
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="qibla-tick${className}" />`;
}

function dialTicks() {
  return Array.from({ length: 36 }, (_, index) => tick(index * 10)).join("");
}

export function renderQiblaVisual() {
  return `
    <div class="qibla-visual" data-qibla-visual>
      <img class="qibla-visual__decor qibla-visual__decor--left" src="${QIBLA_ASSETS.decorLeft}" alt="" aria-hidden="true" loading="lazy" decoding="async" />

      <div class="qibla-compass-stage" data-qibla-compass-stage>
        <div class="qibla-compass" role="img" data-qibla-compass aria-label="اتجاه القبلة">
          <svg class="qibla-compass__svg" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
            <defs>
              <radialGradient id="qiblaDialFace" cx="50%" cy="42%" r="62%">
                <stop offset="0" stop-color="#ffffff" />
                <stop offset="1" stop-color="#fffcf7" />
              </radialGradient>
            </defs>
            <g class="qibla-compass__dial-rotator" data-qibla-dial>
              <circle cx="200" cy="200" r="193" class="qibla-dial-halo" />
              <circle cx="200" cy="200" r="188" class="qibla-dial-outer" />
              <circle cx="200" cy="200" r="178" fill="url(#qiblaDialFace)" class="qibla-dial-face" />
              <circle cx="200" cy="200" r="164" class="qibla-dial-inner" />
              <g class="qibla-dial-ticks">${dialTicks()}</g>
              <text x="200" y="55" class="qibla-cardinal qibla-cardinal--north">N</text>
              <text x="345" y="207" class="qibla-cardinal">E</text>
              <text x="200" y="357" class="qibla-cardinal">S</text>
              <text x="55" y="207" class="qibla-cardinal">W</text>
            </g>
            <g class="qibla-needle" data-qibla-arrow>
              <path d="M200 58 L211 184 L200 200 L189 184 Z" class="qibla-needle__shaft" />
              <path d="M200 42 L215 78 L200 69 L185 78 Z" class="qibla-needle__head" />
              <path d="M200 342 L194 214 L200 200 L206 214 Z" class="qibla-needle__counterweight" />
            </g>
            <g class="qibla-kaaba-center">
              <circle cx="200" cy="200" r="34" class="qibla-kaaba-center__halo" />
              <rect x="181" y="184" width="38" height="34" rx="3" class="qibla-kaaba-center__body" />
              <path d="M181 193h38M187 184v34M213 184v34" class="qibla-kaaba-center__detail" />
              <circle cx="200" cy="200" r="7" class="qibla-kaaba-center__pivot" />
            </g>
          </svg>
          <span class="qibla-compass__forward-marker" aria-hidden="true"><span></span><small>أعلى الهاتف</small></span>
        </div>
      </div>

      <div class="qibla-compass__controls" data-qibla-controls>
        <p class="qibla-compass__guidance" data-qibla-guidance>اتجاه القبلة من الشمال</p>
        <div class="qibla-compass__unsupported" data-qibla-unsupported role="status" hidden>
          <span class="qibla-compass__unsupported-icon" aria-hidden="true">i</span>
          <div>
            <h3 class="qibla-compass__unsupported-title">البوصلة غير متاحة على هذا الجهاز</h3>
            <p class="qibla-compass__unsupported-description">ميزة البوصلة تعمل على الهواتف والأجهزة اللوحية التي تدعم مستشعرات الاتجاه. افتح موقع موقوتًا من جهاز محمول لاستخدامها.</p>
          </div>
        </div>
        <p class="qibla-compass__sensor-status" data-qibla-heading-status>البوصلة الثابتة متاحة</p>
        <p class="qibla-compass__accuracy" data-qibla-accuracy hidden></p>
        <button type="button" class="qibla-compass__enable" data-qibla-heading-enable>تفعيل بوصلة الجهاز</button>
      </div>

      <img class="qibla-visual__decor qibla-visual__decor--right" src="${QIBLA_ASSETS.decorRight}" alt="" aria-hidden="true" loading="lazy" decoding="async" />
    </div>
  `;
}
