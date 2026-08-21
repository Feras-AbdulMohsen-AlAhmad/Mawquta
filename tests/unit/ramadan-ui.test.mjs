// UI / component tests for the Ramadan section components.
// Verifies render-only hooks (no hardcoded values), the shared month-table grid
// driven by real rows (desktop + mobile from one source), the constants shape
// and that the section carries the runtime hooks.

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const sectionUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/ramadan.section.js",
).href;
const topbarUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/components/ramadan-topbar.component.js",
).href;
const countdownUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/components/ramadan-countdown-card.component.js",
).href;
const gridUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/components/ramadan-month-table-grid.component.js",
).href;
const constantsUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/components/ramadan-month-table.constants.js",
).href;
const ramadanYearUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/utils/ramadan-year.util.js",
).href;

const { renderRamadanSection } = await import(sectionUrl);
const { renderRamadanTopbar } = await import(topbarUrl);
const { renderRamadanCountdownCard } = await import(countdownUrl);
const {
  renderRamadanMonthTableGrid,
  renderRamadanTimetableLoading,
  renderRamadanTimetableNoLocation,
  renderRamadanTimetableNoData,
  renderRamadanTimetableMissingData,
  renderRamadanTimetableError,
} = await import(gridUrl);
const { MONTH_TABLE_ICON_PATHS, RAMADAN_MONTH_TABLE_COLUMNS } =
  await import(constantsUrl);
const { getNextRamadanGregorianYear } = await import(ramadanYearUrl);

const results = [];
function record(id, pass, detail) {
  results.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${detail}`);
}
async function checkAsync(id, fn) {
  try {
    await fn();
    record(id, true, "ok");
  } catch (err) {
    record(id, false, err.message);
  }
}

class FakeElement {
  constructor() {
    this.textContent = "";
    this.innerHTML = "";
  }
}

const SAMPLE_ROWS = [
  {
    dateKey: "2026-03-15",
    gregorianDate: "15/03",
    weekday: "الأحد",
    ramadanDay: 26,
    fajr: "05:38",
    dhuhr: "12:45",
    asr: "16:08",
    maghrib: "18:43",
    isha: "19:51",
    isToday: true,
    activePrayerKeys: ["fajr", "dhuhr"],
  },
  {
    dateKey: "2026-03-16",
    gregorianDate: "16/03",
    weekday: "الاثنين",
    ramadanDay: 27,
    fajr: "05:37",
    dhuhr: "12:45",
    asr: "16:08",
    maghrib: "18:44",
    isha: "19:52",
    isToday: false,
    activePrayerKeys: [],
  },
];

await checkAsync("UI-01", async () => {
  // Topbar: render-only hooks, placeholder values, no static data.
  const html = renderRamadanTopbar(MONTH_TABLE_ICON_PATHS);
  for (const hook of [
    "data-ramadan-month",
    "data-ramadan-updated",
    "data-ramadan-day-label",
    "data-ramadan-day",
    "data-ramadan-city",
  ]) {
    assert.ok(html.includes(hook), `hook ${hook} present`);
  }
  assert.ok(html.includes(">—</span>"), "placeholder month value");
  assert.ok(html.includes('data-ramadan-month>—<'), "no month static value");
  for (const forbidden of ["2026", "15:42", "04:12", "18:42", "6 رمضان", "26 رمضان"]) {
    assert.ok(!html.includes(forbidden), `topbar no static fixture ${forbidden}`);
  }
  assert.ok(!html.includes("رمضان 2026"), "no static month title");
});

await checkAsync("UI-02", async () => {
  // Countdown card: render-only hooks, placeholders, no static times.
  const html = renderRamadanCountdownCard();
  for (const hook of [
    "data-ramadan-iftar",
    "data-ramadan-imsak",
    "data-ramadan-countdown",
    "data-ramadan-countdown-title",
    "data-ramadan-countdown-hours",
    "data-ramadan-countdown-minutes",
    "data-ramadan-countdown-seconds",
  ]) {
    assert.ok(html.includes(hook), `hook ${hook} present`);
  }
  assert.ok(html.includes("--:--"), "placeholder pill values");
  assert.ok(html.includes('data-ramadan-countdown-title>—<'), "placeholder title");
  for (const forbidden of ["18:42", "04:12", "02", "16:44", "الوقت المتبقي للأذان"]) {
    assert.ok(!html.includes(forbidden), `countdown no static fixture ${forbidden}`);
  }
});

await checkAsync("UI-03", async () => {
  // Constants: 8 columns, canonical order, no static rows export.
  assert.equal(RAMADAN_MONTH_TABLE_COLUMNS.length, 8);
  assert.deepEqual(
    RAMADAN_MONTH_TABLE_COLUMNS.map((column) => column.key),
    ["ramadanDayNumber", "day", "fajr", "dhuhr", "asr", "maghrib", "isha", "date"],
  );
  assert.equal(RAMADAN_MONTH_TABLE_COLUMNS[0].label, "رمضان");
  const constantsSource = await (
    await import("node:fs")
  ).promises.readFile(
    new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/ramadan/components/ramadan-month-table.constants.js",
    "utf8",
  );
  assert.ok(!constantsSource.includes("RAMADAN_MONTH_TABLE_ROWS"), "no static rows constant");
});

await checkAsync("UI-04", async () => {
  // Grid: location/range labels, real aria label, desktop + mobile rows from
  // the same source, active cells and today row.
  const html = renderRamadanMonthTableGrid({
    columns: RAMADAN_MONTH_TABLE_COLUMNS,
    rows: SAMPLE_ROWS,
    iconPaths: MONTH_TABLE_ICON_PATHS,
    locationLabel: "دمشق، سوريا",
    rangeLabel: "مارس 2026",
  });

  assert.ok(html.includes("data-rt-city>دمشق، سوريا<"), "location label rendered");
  assert.ok(html.includes("data-rt-range>مارس 2026<"), "range label rendered");

  assert.ok(html.includes('aria-label="جدول رمضان"'), "real table aria label");
  assert.ok(!html.includes("جدول رمضان الثابت"), "no static label");

  const desktopRows = (html.match(/<tr/g) || []).length - 1;
  const mobileCards = (html.match(/weekly-table-mobile-card/g) || []).length;
  assert.equal(desktopRows, SAMPLE_ROWS.length, "desktop rows match source");
  assert.equal(mobileCards, SAMPLE_ROWS.length, "mobile cards match source");

  assert.ok(html.includes("table-row--today"), "today row styled");
  assert.ok(html.includes("ramadan-mobile-card--today"), "today mobile card styled");
  assert.ok(html.includes('aria-current="date"'), "today mobile card semantics");
  assert.ok(html.includes("table-cell--active"), "active prayer cell present");
  assert.ok(html.includes("table-time-pill"), "active pill present");

  assert.ok(html.includes(">26<"), "ramadan day value rendered");
  assert.ok(html.includes(">الأحد<"), "weekday value rendered");
  assert.ok(html.includes(">15/03<"), "gregorian date rendered");
});

await checkAsync("UI-05", async () => {
  // Section: mounts topbar + countdown + status region + month-table section
  // with an empty grid placeholder and the visual-only "عرض المزيد" button.
  const root = new FakeElement();
  renderRamadanSection(root);

  assert.ok(root.innerHTML.includes('id="ramadan"'), "ramadan section id");
  assert.ok(root.innerHTML.includes("data-ramadan-data"), "status region hook");
  assert.ok(root.innerHTML.includes("data-ramadan-month-table-grid"), "grid mount hook");
  assert.ok(root.innerHTML.includes("data-rt-load-more"), "load-more hook");
  assert.ok(root.innerHTML.includes("عرض المزيد"), "load-more label");
  assert.ok(root.innerHTML.includes("data-ramadan-month"), "topbar mounted");
  assert.ok(root.innerHTML.includes("data-rt-head-hijri"), "head hijri hook");
  assert.ok(root.innerHTML.includes("data-rt-head-gregorian"), "head gregorian hook");
  assert.ok(root.innerHTML.includes("data-rt-head-hijri>—<"), "head hijri placeholder");
  assert.ok(root.innerHTML.includes("data-rt-head-gregorian>—<"), "head gregorian placeholder");

  for (const forbidden of ["2026", "15:42", "04:12", "18:42", "1448", "أحد</td>", ">05:00<"]) {
    assert.ok(!root.innerHTML.includes(forbidden), `section no static fixture ${forbidden}`);
  }
});

await checkAsync("UI-06", async () => {
  assert.ok(renderRamadanTimetableLoading().includes("ramadan-timetable-skeleton"));
  assert.ok(renderRamadanTimetableNoLocation().includes("اختر مدينة لعرض إمساكية رمضان"));
  assert.ok(renderRamadanTimetableNoData().includes("لا توجد إمساكية رمضان متاحة حاليًا"));
  assert.ok(renderRamadanTimetableMissingData().includes("لا تتوفر بيانات الإمساكية لهذا الشهر"));
  assert.ok(renderRamadanTimetableError().includes("data-ramadan-retry"));
  assert.ok(!renderRamadanTimetableLoading().includes("05:42"));
});

await checkAsync("UI-07", async () => {
  const yearCopy = renderRamadanTimetableNoData({ nextRamadanGregorianYear: 2027 });
  assert.ok(yearCopy.includes("لا توجد إمساكية رمضان متاحة حاليًا"), "refined headline");
  assert.ok(yearCopy.includes("ستتوفر المواقيت عند بدء شهر رمضان القادم في عام 2027."), "year explanation");
  assert.ok(yearCopy.includes("ramadan-timetable-state__illustration"), "Ramadan illustration composition");
  assert.ok(yearCopy.includes("ramadan-crescent-star.svg"), "existing Ramadan illustration asset");
  assert.ok(!yearCopy.includes("illustration-mark"), "single illustration only");
  assert.ok(yearCopy.includes("data-global-location-control"), "city CTA preserved");

  const fallbackCopy = renderRamadanTimetableNoData();
  assert.ok(fallbackCopy.includes("ستتوفر المواقيت عند بدء شهر رمضان القادم."), "year fallback copy");
  assert.ok(!fallbackCopy.includes("في عام undefined"), "fallback avoids undefined year");

  assert.equal(
    getNextRamadanGregorianYear({ timeZone: "Asia/Damascus", nowDate: new Date("2026-03-15T12:00:00+03:00") }),
    2027,
    "next Ramadan year derived from runtime date",
  );
  assert.equal(
    getNextRamadanGregorianYear({ timeZone: "Invalid/Timezone", nowDate: new Date("2026-03-15T12:00:00+03:00") }),
    null,
    "unsupported timezone falls back cleanly",
  );
});

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(
  `UI_SUMMARY pass=${passed} fail=${failed.length} total=${results.length}`,
);
if (failed.length > 0) {
  console.error("Failed:", failed.map((r) => r.id).join(", "));
  process.exit(1);
} else {
  process.exit(0);
}
