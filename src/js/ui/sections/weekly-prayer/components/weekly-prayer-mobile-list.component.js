import { renderScheduleTableMobileList } from "../../../shared/primitives/schedule-table.primitives.js";
import { formatPrayerTimeForDisplay, PRAYER_LABELS_AR_BY_KEY } from "../../../../utils/prayer-format.util.js";
import { findWeeklyRowByKey, getDefaultWeeklyDayKey } from "./weekly-prayer-selection.util.js";

const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function renderWeeklyPrayerMobileList({ rows, selectedDayKey, iconPaths }) {
  const selectedRow =
    findWeeklyRowByKey(rows, selectedDayKey) ??
    findWeeklyRowByKey(rows, getDefaultWeeklyDayKey(rows));

  if (!selectedRow) return "";

  return renderScheduleTableMobileList({
    ariaLabel: "مواقيت الصلاة الأسبوعية - عرض الموبايل",
    cards: [
      {
        ariaLabel: `مواقيت ${selectedRow.day}`,
        title: selectedRow.day,
        date: selectedRow.dateLabel ?? selectedRow.date,
        pillText: selectedRow.isToday ? "اليوم" : "",
        titleIconPath: iconPaths.day,
        dateIconPath: iconPaths.date,
        prayers: PRAYER_KEYS.map((key) => ({
          label: PRAYER_LABELS_AR_BY_KEY[key] ?? key,
          time: formatPrayerTimeForDisplay(selectedRow[key]),
          iconPath: iconPaths[key],
          isActive: selectedRow.isToday && selectedRow.activePrayer === key,
        })),
      },
    ],
  });
}

