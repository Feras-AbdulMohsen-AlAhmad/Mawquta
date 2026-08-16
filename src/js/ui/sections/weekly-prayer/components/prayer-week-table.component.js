import {
  WEEKLY_ICON_PATHS,
  WEEKLY_TABLE_COLUMNS,
} from "./weekly-prayer.constants.js";
import { renderWeeklyPrayerTable } from "./weekly-prayer-table.component.js";
import { renderWeeklyPrayerMobileList } from "./weekly-prayer-mobile-list.component.js";

function renderWeeklyPrayerDaySelector(rows, selectedDayKey, disabled = false) {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  return `
    <div class="weekly-table-mobile-selector">
      <label class="weekly-table-mobile-selector__label" for="weekly-day-select">اختيار اليوم</label>
      <select id="weekly-day-select" class="weekly-table-mobile-selector__control" data-weekly-day-select aria-label="اختيار اليوم"${disabled ? " disabled" : ""}>
        ${rows
          .filter((row) => typeof row?.dateKey === "string")
          .map(
            (row) =>
              `<option value="${row.dateKey}"${row.dateKey === selectedDayKey ? " selected" : ""}>${row.day} — ${row.dateLabel ?? row.date}</option>`,
          )
          .join("\n")}
      </select>
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
        <p class="schedule-table-subtitle">الصلاوات لسبع أيام قادمة</p>
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
