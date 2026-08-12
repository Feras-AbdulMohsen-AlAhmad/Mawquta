function getPrayerAriaLabel(prayer) {
  if (prayer.isNext) return `صلاة ${prayer.label} - الصلاة القادمة`;
  if (prayer.isPassed) return `صلاة ${prayer.label} - صلاة سابقة`;
  return `صلاة ${prayer.label}`;
}

function renderPrayerCard(prayer, activeKey) {
  const isActive = prayer.key === activeKey;
  const activeClass = isActive ? " daily-prayer-card--active" : "";
  const activeAttributes = isActive ? ' aria-current="true"' : "";

  return `
    <article class="daily-prayer-card daily-prayer-card--${prayer.key}${activeClass}" role="listitem" aria-label="${getPrayerAriaLabel(prayer)}"${activeAttributes}>
      <img class="daily-prayer-card__artwork" src="assets/illustrations/daily-prayer/${prayer.key}-card-artwork.png" alt="" aria-hidden="true" />
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
 * @param {string|null} activeKey - Key of the highlighted card (the next prayer).
 */
export function renderDailyPrayerCards(prayers, activeKey = null) {
  if (!Array.isArray(prayers)) return "";

  const resolvedActiveKey = activeKey ?? prayers.find((p) => p.isNext)?.key ?? null;

  return prayers
    .map((prayer) => renderPrayerCard(prayer, resolvedActiveKey))
    .join("\n");
}
