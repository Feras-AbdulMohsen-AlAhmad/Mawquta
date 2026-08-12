import { renderScheduleTableHeader } from "../../../shared/primitives/schedule-table.primitives.js";
import { formatPrayerTimeForDisplay } from "../../../../utils/prayer-format.util.js";

function renderDesktopPrayerCell(row, prayerKey) {
  const displayTime = formatPrayerTimeForDisplay(row[prayerKey]);
  const cellClass = `table-cell--prayer table-cell--${prayerKey}`;
  if (row.activePrayer === prayerKey) {
    return `<td class="${cellClass} table-cell--active"><span class="table-time-pill"><span class="weekly-table-cell-value">${displayTime}</span></span></td>`;
  }

  return `<td class="${cellClass}"><span class="weekly-table-cell-value">${displayTime}</span></td>`;
}

function renderDesktopTableRow(row) {
  const todayClass = row.isToday ? ' class="table-row--today"' : "";

  return `
    <tr${todayClass}>
      <td class="table-cell--day"><span class="weekly-table-cell-value">${row.day}</span></td>
      ${renderDesktopPrayerCell(row, "fajr")}
      ${renderDesktopPrayerCell(row, "dhuhr")}
      ${renderDesktopPrayerCell(row, "asr")}
      ${renderDesktopPrayerCell(row, "maghrib")}
      ${renderDesktopPrayerCell(row, "isha")}
      <td class="table-cell--date"><span class="weekly-table-cell-value">${row.date}</span></td>
    </tr>
  `;
}

export function renderWeeklyPrayerTable({ columns, rows }) {
  return `
    <div class="schedule-table-wrap">
      <table class="schedule-table" aria-label="جدول مواقيت الصلاة الأسبوعي">
        <thead>
          <tr>
            ${renderScheduleTableHeader(columns)}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => renderDesktopTableRow(row)).join("\n")}
        </tbody>
      </table>
    </div>
  `;
}

