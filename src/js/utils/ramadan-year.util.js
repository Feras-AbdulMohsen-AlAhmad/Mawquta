/**
 * Returns the Gregorian year containing the next 1 Ramadan for a runtime
 * timezone. The Islamic calendar formatter keeps this dynamic without a
 * fixed year or an additional API request.
 */
export function getNextRamadanGregorianYear({ contract, timeZone, nowDate = new Date() } = {}) {
  const contractYear = Number(contract?.nextRamadanGregorianYear);
  if (Number.isInteger(contractYear) && contractYear >= 1900 && contractYear <= 3000) {
    return contractYear;
  }

  if (typeof timeZone !== "string" || !timeZone.trim()) return null;

  try {
    const islamicFormatter = new Intl.DateTimeFormat(
      "en-u-ca-islamic-umalqura-nu-latn",
      { timeZone, month: "numeric", day: "numeric" },
    );
    const gregorianFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
    });

    for (let offset = 0; offset <= 400; offset += 1) {
      const candidate = new Date(nowDate.getTime() + offset * 24 * 60 * 60 * 1000);
      const islamicParts = islamicFormatter.formatToParts(candidate);
      const month = Number(
        islamicParts.find((part) => part.type === "month")?.value,
      );
      const day = Number(
        islamicParts.find((part) => part.type === "day")?.value,
      );

      if (month === 9 && day === 1) {
        const year = Number(
          gregorianFormatter
            .formatToParts(candidate)
            .find((part) => part.type === "year")?.value,
        );
        return Number.isInteger(year) ? year : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}
