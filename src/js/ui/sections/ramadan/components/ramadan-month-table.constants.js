export const MONTH_TABLE_ICON_PATHS = {
  isha: "assets/icons/shared/prayer/isha.svg",
  maghrib: "assets/icons/shared/prayer/maghrib.svg",
  asr: "assets/icons/shared/prayer/asr.svg",
  dhuhr: "assets/icons/shared/prayer/dhuhr.svg",
  fajr: "assets/icons/shared/prayer/fajr.svg",
  date: "assets/icons/shared/prayer/date.svg",
  day: "assets/icons/shared/prayer/today.svg",
  ramadan: "assets/icons/ramadan/ramadan-crescent-star.svg",
  download: "assets/icons/sections/ramadan/action-download.svg",
  share: "assets/icons/sections/ramadan/action-share.svg",
};

export const RAMADAN_MONTH_TABLE_COLUMNS = [
  {
    key: "ramadanDayNumber",
    label: "رمضان",
    icon: MONTH_TABLE_ICON_PATHS.ramadan,
  },
  {
    key: "day",
    label: "اليوم",
    icon: MONTH_TABLE_ICON_PATHS.day,
  },
  {
    key: "fajr",
    label: "الفجر",
    icon: MONTH_TABLE_ICON_PATHS.fajr,
  },
  {
    key: "dhuhr",
    label: "الظهر",
    icon: MONTH_TABLE_ICON_PATHS.dhuhr,
  },
  {
    key: "asr",
    label: "العصر",
    icon: MONTH_TABLE_ICON_PATHS.asr,
  },
  {
    key: "maghrib",
    label: "المغرب",
    icon: MONTH_TABLE_ICON_PATHS.maghrib,
  },
  {
    key: "isha",
    label: "العشاء",
    icon: MONTH_TABLE_ICON_PATHS.isha,
  },
  {
    key: "date",
    label: "التاريخ",
    icon: MONTH_TABLE_ICON_PATHS.date,
  },
];
