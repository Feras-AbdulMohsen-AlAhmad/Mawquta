import { renderRamadanCountdownCard } from "./ramadan-countdown-card.component.js";
import { renderRamadanMonthTableHead } from "./ramadan-month-table-head.component.js";
import { MONTH_TABLE_ICON_PATHS } from "./ramadan-month-table.constants.js";

export function renderRamadanCountdown() {
  return renderRamadanCountdownCard();
}

export function renderRamadanMonthTable() {
  return `
    <section class="ramadan-month-table-section" aria-label="جدول شهر رمضان">
      ${renderRamadanMonthTableHead(MONTH_TABLE_ICON_PATHS)}

      <div data-ramadan-month-table-grid></div>

      <div class="ramadan-month-table__more" data-ramadan-table-more>
        <button type="button" class="section-more-button section-more-button--filled" data-rt-load-more>عرض المزيد</button>
      </div>
    </section>
  `;
}
