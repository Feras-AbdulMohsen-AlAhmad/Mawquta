import {
  WEEKLY_ICON_PATHS,
  WEEKLY_TABLE_COLUMNS,
} from "./weekly-prayer.constants.js";
import { renderWeeklyPrayerTable } from "./weekly-prayer-table.component.js";
import { renderWeeklyPrayerMobileList } from "./weekly-prayer-mobile-list.component.js";

export function renderWeeklyPrayerTableCard({
  rangeText,
  rows,
  mobileCard,
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

      ${renderWeeklyPrayerTable({
        columns: WEEKLY_TABLE_COLUMNS,
        rows,
      })}

      ${renderWeeklyPrayerMobileList({
        mobileCard,
        iconPaths: WEEKLY_ICON_PATHS,
      })}
    </div>
  `;
}
