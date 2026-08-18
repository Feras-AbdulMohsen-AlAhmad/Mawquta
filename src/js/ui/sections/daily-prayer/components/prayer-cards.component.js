function getPrayerAriaLabel(prayer, isCurrent) {
  if (isCurrent) return `صلاة ${prayer.label} - الصلاة الحالية`;
  if (prayer.isNext) return `صلاة ${prayer.label} - الصلاة القادمة`;
  if (prayer.isPassed) return `صلاة ${prayer.label} - صلاة سابقة`;
  return `صلاة ${prayer.label}`;
}

export function getCurrentPrayerKey(prayers) {
  if (!Array.isArray(prayers) || prayers.length === 0) return null;

  const lastPassedPrayer = prayers.findLast((prayer) => prayer.isPassed);
  return lastPassedPrayer?.key ?? prayers.find((prayer) => prayer.key === "isha")?.key ?? null;
}

function renderPrayerCard(prayer, currentKey) {
  const isCurrent = prayer.key === currentKey;
  const currentClass = isCurrent ? " daily-prayer-card--current" : "";
  const currentAttributes = isCurrent ? ' aria-current="true"' : "";

  return `
    <article class="daily-prayer-card daily-prayer-card--${prayer.key}${currentClass}" role="listitem" aria-label="${getPrayerAriaLabel(prayer, isCurrent)}"${currentAttributes}>
      <img class="daily-prayer-card__artwork" src="assets/illustrations/daily-prayer/${prayer.key}-card-artwork.png" alt="" aria-hidden="true" />
      ${isCurrent ? '<span class="daily-prayer-card__current-badge">الصلاة الحالية</span>' : ""}
      <div class="daily-prayer-card__inner">
        <h3 class="daily-prayer-card__name">${prayer.label}</h3>
        <div class="daily-prayer-card__time-wrap">
          <span class="daily-prayer-card__time">${prayer.time}</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Renders the daily prayer cards.
 *
 * @param {Array} prayers - Normalized prayer objects: { key, label, time, isNext, isPassed }.
 * @param {string|null} currentKey - Key of the prayer whose period is currently active.
 */
export function renderDailyPrayerCards(prayers, currentKey = null) {
  if (!Array.isArray(prayers)) return "";

  const resolvedCurrentKey = currentKey ?? getCurrentPrayerKey(prayers);

  return prayers
    .map((prayer) => renderPrayerCard(prayer, resolvedCurrentKey))
    .join("\n");
}
