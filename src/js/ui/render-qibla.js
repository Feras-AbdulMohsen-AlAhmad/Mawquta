// src/js/ui/render-qibla.js

export function renderQibla(containerEl, vm, onUseMyLocation) {
  if (!containerEl) return;

  // Case: we don't have coords yet (type=city)
  if (!vm) {
    containerEl.innerHTML = `
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="text-muted small">فعّل الموقع لعرض اتجاه القبلة.</div>
        <button id="btnQiblaUseLocation" class="btn btn-sm btn-outline-primary">
          استخدم موقعي
        </button>
      </div>
    `;

    containerEl
      .querySelector("#btnQiblaUseLocation")
      ?.addEventListener("click", () => {
        if (typeof onUseMyLocation === "function") onUseMyLocation();
      });

    return;
  }

  // Case: coords available
  //   const deg = Math.round(vm.direction);
  const deg = 100; // مؤقت للتجربة

  containerEl.innerHTML = `
    <div class="d-flex align-items-center gap-3">
      <div class="qibla-compass" aria-label="Qibla compass">
        <div class="qibla-needle" style="transform: rotate(${deg}deg);">
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2 L20 20 L12 16 L4 20 Z" fill="currentColor"></path>
            </svg>
        </div>
      </div>

      <div class="small text-muted">
        <div>الدرجة من الشمال</div>
        <div class="fw-semibold text-body">${deg}°</div>
      </div>
    </div>
  `;
}
