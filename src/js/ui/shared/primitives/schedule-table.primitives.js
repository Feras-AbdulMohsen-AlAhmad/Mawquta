const PRAYER_COLUMN_KEYS = new Set(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

export function isSchedulePrayerColumn(columnKey) {
  return PRAYER_COLUMN_KEYS.has(columnKey);
}

export function resolveScheduleTableHeaderClass(
  columnKey,
  { leadingColumnKeys = [] } = {},
) {
  if (
    columnKey === "day" ||
    columnKey === "date" ||
    leadingColumnKeys.includes(columnKey)
  ) {
    return `table-head table-head--${columnKey}`;
  }

  if (isSchedulePrayerColumn(columnKey)) {
    return `table-head table-head--prayer table-head--${columnKey}`;
  }

  return `table-head table-head--${columnKey}`;
}

export function renderScheduleTableHeaderCell(column, headerClassName) {
  return `<th scope="col" class="${headerClassName}"><span class="schedule-table-head-label"><span class="schedule-table-head-icon" aria-hidden="true"><img src="${column.icon}" alt="" loading="lazy" decoding="async" /></span><span class="schedule-table-head-text">${column.label}</span></span></th>`;
}

export function renderScheduleTableHeader(
  columns,
  { leadingColumnKeys = [] } = {},
) {
  return columns
    .map((column) =>
      renderScheduleTableHeaderCell(
        column,
        resolveScheduleTableHeaderClass(column.key, { leadingColumnKeys }),
      ),
    )
    .join("\n");
}

export function renderScheduleTableMobilePrayerItem({
  label,
  time,
  iconPath,
  isActive = false,
}) {
  const activeClass = isActive ? " weekly-table-mobile-item--active" : "";

  return `<div class="weekly-table-mobile-item${activeClass}"><dt><span class="weekly-table-mobile-item-icon" aria-hidden="true"><img src="${iconPath}" alt="" loading="lazy" decoding="async" /></span>${label}</dt><dd>${time}</dd></div>`;
}

export function renderScheduleTableMobileCard({
  ariaLabel,
  title,
  date,
  pillText,
  titleIconPath,
  dateIconPath,
  prayers,
}) {
  return `
    <article class="weekly-table-mobile-card" aria-label="${ariaLabel}">
      <div class="weekly-table-mobile-head">
        <div class="weekly-table-mobile-title-wrap">
          <h3 class="weekly-table-mobile-title"><span class="weekly-table-mobile-head-icon" aria-hidden="true"><img src="${titleIconPath}" alt="" loading="lazy" decoding="async" /></span>${title}</h3>
          <span class="weekly-table-mobile-date"><span class="weekly-table-mobile-meta-icon" aria-hidden="true"><img src="${dateIconPath}" alt="" loading="lazy" decoding="async" /></span>${date}</span>
        </div>
        <span class="weekly-table-mobile-pill">${pillText}</span>
      </div>

      <dl class="weekly-table-mobile-grid">
        ${prayers
          .map((prayer) => renderScheduleTableMobilePrayerItem(prayer))
          .join("\n")}
      </dl>
    </article>
  `;
}

export function renderScheduleTableMobileList({ ariaLabel, cards }) {
  return `
    <div class="weekly-table-mobile-list" aria-label="${ariaLabel}">
      ${cards.map((card) => renderScheduleTableMobileCard(card)).join("\n")}
    </div>
  `;
}
