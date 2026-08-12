export const WEEKLY_ICON_PATHS = {
  day: "assets/icons/shared/calendar-check.svg",
  date: "assets/icons/shared/calendar.svg",
  fajr: "assets/icons/prayer-times/prayer-fajr.svg",
  dhuhr: "assets/icons/prayer-times/prayer-dhuhr.svg",
  asr: "assets/icons/prayer-times/prayer-asr.svg",
  maghrib: "assets/icons/prayer-times/prayer-maghrib.svg",
  isha: "assets/icons/prayer-times/prayer-isha.svg",
};

export const WEEKLY_TABLE_COLUMNS = [
  { key: "day", label: "اليوم", icon: WEEKLY_ICON_PATHS.day },
  { key: "fajr", label: "الفجر", icon: WEEKLY_ICON_PATHS.fajr },
  { key: "dhuhr", label: "الظهر", icon: WEEKLY_ICON_PATHS.dhuhr },
  { key: "asr", label: "العصر", icon: WEEKLY_ICON_PATHS.asr },
  { key: "maghrib", label: "المغرب", icon: WEEKLY_ICON_PATHS.maghrib },
  { key: "isha", label: "العشاء", icon: WEEKLY_ICON_PATHS.isha },
  { key: "date", label: "التاريخ", icon: WEEKLY_ICON_PATHS.date },
];
