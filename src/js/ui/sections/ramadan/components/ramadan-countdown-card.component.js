const RAMADAN_DAY_TIME_CARDS = [
  {
    modifierClass: "ramadan-first-time--imsak",
    label: "وقت الإمساك اليوم",
    iconClass: "ramadan-first-time__icon--imsak",
    valueDataAttribute: "data-ramadan-imsak",
  },
  {
    modifierClass: "ramadan-first-time--iftar",
    label: "وقت الإفطار اليوم",
    iconClass: "ramadan-first-time__icon--iftar",
    valueDataAttribute: "data-ramadan-iftar",
  },
];

const RAMADAN_COUNTDOWN_PARTS = [
  {
    unit: "ساعة",
    dataAttribute: "data-ramadan-countdown-hours",
  },
  {
    unit: "دقيقة",
    dataAttribute: "data-ramadan-countdown-minutes",
  },
  {
    unit: "ثانية",
    dataAttribute: "data-ramadan-countdown-seconds",
  },
];

function renderRamadanDayTimeCard(cardConfig) {
  return `
    <article class="ramadan-first-time ${cardConfig.modifierClass}">
      <div class="ramadan-first-time__inner">
        <span class="ramadan-first-time__label-wrap">
          <span class="ramadan-first-time__icon ${cardConfig.iconClass}" aria-hidden="true"></span>
          <span class="ramadan-first-time__label">${cardConfig.label}</span>
        </span>
        <span class="ramadan-first-time__pill" ${cardConfig.valueDataAttribute}>--:--</span>
      </div>
    </article>
  `;
}

function renderRamadanProgress() {
  return `
    <div class="ramadan-first__progress" aria-label="نسبة مرور وقت الصيام">
      <div class="ramadan-first__progress-row">
        <span class="ramadan-first__progress-edge">
          <span class="ramadan-first__progress-icon ramadan-first__progress-icon--start" aria-hidden="true"></span>
          <span data-ramadan-progress-iftar>--:--</span>
        </span>
        <span class="ramadan-first__progress-value" data-ramadan-progress-label>--%</span>
        <span class="ramadan-first__progress-edge">
          <span data-ramadan-progress-imsak>--:--</span>
          <span class="ramadan-first__progress-icon ramadan-first__progress-icon--end" aria-hidden="true"></span>
        </span>
      </div>
      <div class="ramadan-first__progress-track" role="progressbar" aria-label="نسبة مرور وقت الصيام" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <span class="ramadan-first__progress-fill" data-ramadan-progress-fill style="inline-size: 0%"></span>
      </div>
    </div>
  `;
}

function renderRamadanCountdownPart(partConfig) {
  return `<div class="ramadan-first__timer-part"><span class="ramadan-first__timer-value" ${partConfig.dataAttribute}>--</span><span class="ramadan-first__timer-unit">${partConfig.unit}</span></div>`;
}

export function renderRamadanCountdownCard() {
  return `
    <section class="ramadan-first" id="ramadanTodayCard" aria-label="بطاقة رمضان اليومية">
      <div class="ramadan-first__shell">
        <div class="ramadan-first__times">
          ${RAMADAN_DAY_TIME_CARDS.map((cardConfig) => renderRamadanDayTimeCard(cardConfig)).join("\n")}
        </div>

        <div class="ramadan-first__countdown">
          <header class="ramadan-first__countdown-head">
            <span class="ramadan-first__countdown-icon" aria-hidden="true"></span>
            <h3 class="ramadan-first__countdown-title" data-ramadan-countdown-title>—</h3>
          </header>
          <div class="ramadan-first__timer" data-ramadan-countdown>
            ${RAMADAN_COUNTDOWN_PARTS.map((partConfig, index) => {
              const partMarkup = renderRamadanCountdownPart(partConfig);
              const separatorMarkup =
                index < RAMADAN_COUNTDOWN_PARTS.length - 1
                  ? '<span class="ramadan-first__timer-sep">:</span>'
                  : "";

              return `${partMarkup}${separatorMarkup}`;
            }).join("\n")}
          </div>
          ${renderRamadanProgress()}
        </div>
      </div>
    </section>
  `;
}
