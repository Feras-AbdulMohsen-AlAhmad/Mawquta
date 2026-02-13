// Renders the Ramadan countdown and related information in the specified container element
export function renderRamadanCountdown(containerEl, vm) {
  if (!containerEl) return;

  if (!vm) {
    containerEl.innerHTML = `<div class="text-muted small">—</div>`;
    return;
  }

  const days = vm.remainingDays;

  const headerHtml =
    days === 0
      ? `<div class="h4 fw-bold mb-0">رمضان مبارك 🌙</div>`
      : `
        <div class="d-flex align-items-baseline justify-content-between">
          <div class="display-6 fw-bold mb-0">${days}</div>
          <div class="text-muted">يوم</div>
        </div>
      `;

  containerEl.innerHTML = `
    ${headerHtml}

    <div class="text-muted small mt-2">
      يبدأ رمضان (ميلادي): <span class="fw-semibold">${vm.ramadanStartGregorian}</span>
    </div>

    <div class="text-muted small">
      يبدأ رمضان (هجري): <span class="fw-semibold">${vm.ramadanStartHijri}</span>
    </div>
  `;
}
