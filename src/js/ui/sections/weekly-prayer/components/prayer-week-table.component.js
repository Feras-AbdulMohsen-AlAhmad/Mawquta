import {
  WEEKLY_ICON_PATHS,
  WEEKLY_TABLE_COLUMNS,
} from "./weekly-prayer.constants.js";
import { renderWeeklyPrayerTable } from "./weekly-prayer-table.component.js";
import { renderWeeklyPrayerMobileList } from "./weekly-prayer-mobile-list.component.js";
import {
  findWeeklyRowByKey,
  getDefaultWeeklyDayKey,
} from "./weekly-prayer-selection.util.js";

function renderWeeklyPrayerDaySelector(rows, selectedDayKey, disabled = false) {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const validRows = rows.filter((row) => typeof row?.dateKey === "string");
  const resolvedSelectedDayKey =
    findWeeklyRowByKey(validRows, selectedDayKey)?.dateKey ??
    getDefaultWeeklyDayKey(validRows);
  const selectedRow = findWeeklyRowByKey(validRows, resolvedSelectedDayKey);

  return `
    <div class="weekly-table-mobile-selector" data-weekly-selector>
      <label class="weekly-table-mobile-selector__label" id="weekly-day-select-label" for="weekly-day-select">اختيار اليوم</label>
      <button
        id="weekly-day-select"
        class="weekly-table-mobile-selector__control"
        type="button"
        data-weekly-day-select
        data-selected-day-key="${resolvedSelectedDayKey ?? ""}"
        aria-label="اختيار اليوم"
        aria-labelledby="weekly-day-select-label"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="weekly-day-options"
        ${disabled ? "disabled aria-disabled=\"true\"" : ""}
      >
        <span class="weekly-table-mobile-selector__value" data-weekly-day-value>${selectedRow ? `${selectedRow.day} — ${selectedRow.dateLabel ?? selectedRow.date}` : "اختيار اليوم"}</span>
        <span class="weekly-table-mobile-selector__chevron" aria-hidden="true"><img src="assets/icons/shared/chevron-down.svg" alt="" /></span>
      </button>
      <div
        class="weekly-table-mobile-selector__options"
        id="weekly-day-options"
        data-weekly-day-options
        role="listbox"
        aria-labelledby="weekly-day-select-label"
        tabindex="-1"
        hidden
      >
        ${validRows
          .map(
            (row) => `
          <div
            id="weekly-day-option-${row.dateKey}"
            class="weekly-table-mobile-selector__option${row.dateKey === resolvedSelectedDayKey ? " is-selected" : ""}"
            data-weekly-day-option
            data-day-key="${row.dateKey}"
            role="option"
            aria-selected="${row.dateKey === resolvedSelectedDayKey}"
            tabindex="-1"
          >
            <span class="weekly-table-mobile-selector__option-label">${row.day} — ${row.dateLabel ?? row.date}</span>
            <span class="weekly-table-mobile-selector__option-meta">
              ${row.isToday ? '<span class="weekly-table-mobile-selector__today">اليوم</span>' : ""}
              <span class="weekly-table-mobile-selector__check" aria-hidden="true">✓</span>
            </span>
          </div>`,
          )
          .join("\n")}
      </div>
    </div>
  `;
}

export function renderWeeklyPrayerTableCard({
  rangeText,
  rows,
  selectedDayKey,
  selectorDisabled = false,
}) {
  return `
    <div class="schedule-table-card">
      <div class="schedule-table-card__top">
        <p class="schedule-table-subtitle">الصلوات لسبع أيام قادمة</p>
        <div class="schedule-table-range" aria-label="نطاق الأسبوع">
          <span class="schedule-table-range__icon" aria-hidden="true"></span>
          <span class="schedule-table-range__text" data-weekly-range>${rangeText}</span>
        </div>
      </div>

      ${renderWeeklyPrayerDaySelector(rows, selectedDayKey, selectorDisabled)}

      ${renderWeeklyPrayerTable({
        columns: WEEKLY_TABLE_COLUMNS,
        rows,
      })}

      ${renderWeeklyPrayerMobileList({
        rows,
        selectedDayKey,
        iconPaths: WEEKLY_ICON_PATHS,
      })}
    </div>
  `;
}
