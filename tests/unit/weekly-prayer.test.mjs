import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWeeklySectionData,
  getTodayDateKey,
} from "../../src/js/services/weekly-formatter.service.js";
import { renderWeeklyPrayerMobileList } from "../../src/js/ui/sections/weekly-prayer/components/weekly-prayer-mobile-list.component.js";
import { renderWeeklyPrayerTableCard } from "../../src/js/ui/sections/weekly-prayer/components/prayer-week-table.component.js";
import {
  findWeeklyRowByKey,
  getDefaultWeeklyDayKey,
} from "../../src/js/ui/sections/weekly-prayer/components/weekly-prayer-selection.util.js";
import { WEEKLY_ICON_PATHS } from "../../src/js/ui/sections/weekly-prayer/components/weekly-prayer.constants.js";
import { makeWeekSlice } from "../fixtures/calendar.mjs";

const TIME_ZONE = "Asia/Damascus";
const NOW = new Date("2026-03-15T12:00:00+03:00");

function buildRows(startDay = 15) {
  return buildWeeklySectionData({
    calendarDays: makeWeekSlice({ year: 2026, month: 3, startDay }),
    timeZone: TIME_ZONE,
    now: NOW,
  }).rows;
}

test("Weekly Prayer defaults to today's stable date key", () => {
  const rows = buildRows();

  assert.equal(getTodayDateKey(TIME_ZONE, NOW), "2026-03-15");
  assert.equal(getDefaultWeeklyDayKey(rows), "2026-03-15");
  assert.equal(rows.find((row) => row.isToday)?.activePrayer, "fajr");
});

test("Weekly Prayer falls back to the first valid row when today is absent", () => {
  const rows = buildRows(16);
  const sectionData = buildWeeklySectionData({
    calendarDays: makeWeekSlice({ year: 2026, month: 3, startDay: 16 }),
    timeZone: TIME_ZONE,
    now: NOW,
  });

  assert.equal(getDefaultWeeklyDayKey(rows), "2026-03-16");
  assert.equal(sectionData.mobileCard.badge, "");
  assert.equal(sectionData.rows.some((row) => row.activePrayer), false);
});

test("Weekly Prayer renders a locally selected day without today's semantics", () => {
  const rows = buildRows();
  const selectedRow = findWeeklyRowByKey(rows, "2026-03-16");
  const html = renderWeeklyPrayerMobileList({
    rows,
    selectedDayKey: selectedRow.dateKey,
    iconPaths: WEEKLY_ICON_PATHS,
  });

  assert.match(html, /الاثنين/);
  assert.match(html, /16 مارس/);
  assert.doesNotMatch(html, />اليوم<\/span>/);
  assert.doesNotMatch(html, /weekly-table-mobile-item--active/);
  assert.equal((html.match(/<time class="weekly-table-mobile-item__time" dir="ltr">/g) || []).length, 5);
  assert.equal((html.match(/class="weekly-table-mobile-item[^\"]*" dir="rtl"/g) || []).length, 5);
});

test("Weekly Prayer renders a custom accessible mobile listbox with Today semantics", () => {
  const rows = buildRows();
  const html = renderWeeklyPrayerTableCard({
    rangeText: "15 مارس — 21 مارس",
    rows,
    selectedDayKey: rows[0].dateKey,
  });

  assert.match(html, /data-weekly-day-select/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /role="listbox"/);
  assert.equal((html.match(/role="option"/g) || []).length, 7);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.equal((html.match(/weekly-table-mobile-selector__today/g) || []).length, 1);
  assert.match(html, /weekly-table-mobile-selector__check/);
});
