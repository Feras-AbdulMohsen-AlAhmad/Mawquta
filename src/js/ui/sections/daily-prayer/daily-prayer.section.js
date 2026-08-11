import { renderDailyPrayerCards } from "./components/prayer-cards.component.js";
import { renderDailyPrayerSectionHead } from "./components/daily-prayer-section-head.component.js";
import { renderSectionDivider } from "../../shared/components/section/section-divider.component.js";

export function renderDailyPrayerSection(rootElement, sectionData = {}) {
  if (!rootElement) {
    return null;
  }

  const {
    cityName = "دمشق، سوريا",
    statusLabel = "جارٍ التحميل…",
    prayers = [],
    activeKey = null,
  } = sectionData;

  rootElement.innerHTML = `
    <section class="daily-prayer-section" id="daily" aria-label="مواقيت الصلاة اليومية">
      <div class="container-xl">
        ${renderDailyPrayerSectionHead({
          cityName,
          statusLabel,
        })}

        <div class="daily-prayer-cards-track" data-daily-data role="list" tabindex="0" aria-label="بطاقات الصلوات اليومية" aria-describedby="daily-prayer-cards-hint">
          ${renderDailyPrayerCards(prayers, activeKey)}
        </div>
        <p class="daily-prayer-cards-hint" id="daily-prayer-cards-hint" aria-hidden="true">اسحب لرؤية بقية الصلوات <span aria-hidden="true">←</span></p>
      </div>
    </section>

    ${renderSectionDivider()}
  `;

  return rootElement;
}
