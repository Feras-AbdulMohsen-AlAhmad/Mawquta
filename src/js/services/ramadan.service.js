import {
  convertGregorianDateToHijriDate,
  convertHijriDateToGregorianDate,
} from "../api/aladhan.api.js";

import { getLocalISODate } from "../utils/date.util.js";

export async function getRamadanCountdown(dateObj = new Date()) {
  //Convert today's Gregorian date to Hijri date
  const hijriDate = await convertGregorianDateToHijriDate(dateObj);

  const nextRamadanHijriDate = nextRamadanDate(
    hijriDate.date,
    hijriDate.day,
    hijriDate.month,
    hijriDate.year,
  );

  const nextRamadanGregorianDate =
    await convertHijriDateToGregorianDate(nextRamadanHijriDate);

  console.log(nextRamadanGregorianDate);
}

getRamadanCountdown(getLocalISODate());

// ====================================================================
// 2) احسب السنة الهجرية المستهدفة لرمضان القادم
// 3) حوّل 01-09-YYYY (هجري) إلى ميلادي
// 4) احسب عدد الأيام المتبقية

function nextRamadanDate(date, day, month, year) {
  if (month < 9) {
    return `${day}-09-${year}`;
  } else {
    date = `${day}-09-${parseInt(year) + 1}`;
    // console.log(date);
    return date;
  }
}
