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
      <div class="modal-dialog qibla-city-modal__dialog">
        <div class="modal-content qibla-city-modal__content">
          <div class="modal-header qibla-city-modal__header">
            <div class="qibla-city-modal__heading">
              <h3 class="modal-title qibla-city-modal__title" id="${modalLabelId}">اختيار المدينة</h3>
              <p class="qibla-city-modal__description">اختر المدينة التي تريد عرض المواقيت بناءً عليها</p>
            </div>
            <button
              type="button"
              class="qibla-city-modal__close"
              data-bs-dismiss="modal"
              aria-label="إغلاق"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div class="modal-body qibla-city-modal__body">
            <div class="qibla-city-modal__current" aria-label="الموقع الحالي">
              <span class="qibla-city-modal__current-icon" aria-hidden="true"></span>
              <span class="qibla-city-modal__current-copy">
                <span class="qibla-city-modal__eyebrow">الموقع الحالي</span>
                <strong class="qibla-city-modal__current-value" data-location-current>لم يتم تحديد مدينة بعد</strong>
              </span>
            </div>

            <div class="qibla-city-modal__search-shell">
              <label class="visually-hidden" for="locationSearchInput">ابحث عن مدينة</label>
              <span class="qibla-city-modal__search-label">ابحث عن مدينة</span>
              <div class="qibla-city-modal__search-control">
                <span class="qibla-city-modal__search-icon" aria-hidden="true"></span>
                <input
                  class="qibla-city-modal__search-input"
                  id="locationSearchInput"
                  type="search"
                  inputmode="search"
                  autocomplete="off"
                  placeholder="ابحث عن مدينة..."
                  aria-describedby="locationPickerStatus"
                  data-location-query
                />
                <button type="button" class="qibla-city-modal__clear" aria-label="مسح البحث" data-location-clear hidden>
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>

            <div class="qibla-city-modal__results-shell">
              <div class="qibla-city-modal__results-heading">
                <span>نتائج البحث</span>
                <span class="qibla-city-modal__results-hint">اختر مدينة للمتابعة</span>
              </div>
              <div
                class="qibla-city-modal__results"
                role="listbox"
                aria-label="نتائج البحث عن المدن"
                data-location-results
              ></div>
            </div>

            <p
              class="qibla-city-modal__status"
              id="locationPickerStatus"
              role="status"
              aria-live="polite"
              data-location-status
            >
              <span>ابحث عن مدينة للبدء</span>
              <small>يمكنك البحث بالعربية أو الإنجليزية</small>
            </p>

            <div class="qibla-city-modal__location-option">
              <button
                type="button"
                class="qibla-city-modal__geolocation"
                data-location-geolocation
              >
                استخدام موقعي
              </button>
            </div>
          </div>

          <div class="qibla-city-modal__actions">
            <p class="qibla-city-modal__candidate" data-location-candidate hidden aria-live="polite"></p>
            <div class="qibla-city-modal__actions-row">
              <button type="button" class="qibla-city-modal__cancel" data-location-cancel>إلغاء</button>
              <button type="button" class="qibla-city-modal__confirm" disabled data-location-confirm>
                تأكيد المدينة
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
