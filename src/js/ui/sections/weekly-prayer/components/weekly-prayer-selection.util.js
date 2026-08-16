export function getDefaultWeeklyDayKey(rows) {
  if (!Array.isArray(rows)) return null;

  return (
    rows.find((row) => row?.isToday && typeof row.dateKey === "string")
      ?.dateKey ??
    rows.find((row) => typeof row?.dateKey === "string")?.dateKey ??
    null
  );
}

export function findWeeklyRowByKey(rows, dateKey) {
  if (!Array.isArray(rows) || typeof dateKey !== "string") return null;
  return rows.find((row) => row?.dateKey === dateKey) ?? null;
}
