export function renderQiblaCityModal({ modalId, modalLabelId }) {
  return `
    <div
      class="modal fade qibla-city-modal"
      id="${modalId}"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${modalLabelId}"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered qibla-city-modal__dialog">
        <div class="modal-content qibla-city-modal__content">
          <div class="modal-header qibla-city-modal__header">
            <h3 class="modal-title qibla-city-modal__title" id="${modalLabelId}">
              اختيار المدينة
            </h3>
            <button
              type="button"
              class="qibla-city-modal__close"
              data-bs-dismiss="modal"
              aria-label="إغلاق"
            >
              إغلاق
            </button>
          </div>

          <div class="modal-body qibla-city-modal__body">
            <p class="qibla-city-modal__note" data-location-current>
              الموقع المختار: دمشق، سوريا
            </p>

            <label class="visually-hidden" for="locationSearchInput">
              ابحث عن مدينة
            </label>
            <input
              class="qibla-city-modal__fake-input form-control"
              id="locationSearchInput"
              type="search"
              inputmode="search"
              autocomplete="off"
              placeholder="أدخل اسم المدينة..."
              aria-describedby="locationPickerStatus"
              data-location-query
            />

            <div
              class="list-group"
              role="listbox"
              aria-label="نتائج البحث عن المدن"
              data-location-results
            ></div>

            <p
              class="alert alert-info mb-0"
              role="status"
              hidden
              data-location-candidate
            ></p>

            <p
              class="qibla-city-modal__note"
              id="locationPickerStatus"
              role="status"
              aria-live="polite"
              data-location-status
            >
              ابحث عن مدينة أو استخدم موقع المتصفح بإذن صريح.
            </p>

            <div class="d-flex flex-wrap gap-2">
              <button
                type="button"
                class="btn btn-outline-secondary flex-grow-1"
                data-location-geolocation
              >
                استخدام موقعي
              </button>

              <button
                type="button"
                class="qibla-city-modal__confirm flex-grow-1"
                disabled
                data-location-confirm
              >
                تأكيد الموقع
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
