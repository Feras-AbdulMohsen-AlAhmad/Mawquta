import { renderHeroCountdown } from "./hero-countdown.component.js";

export function renderHeroNextPrayerCard() {
  return `
    <article class="hero-prayer-card" data-hero-next-prayer-card data-next-prayer="" aria-label="الصلاة القادمة">
      <div class="hero-prayer-card__gloss" aria-hidden="true"></div>

      <div class="hero-prayer-card__header">
        <p class="hero-prayer-card__time" data-hero-next-prayer-time>--:--</p>

        <div class="hero-prayer-card__meta">
          <span class="hero-prayer-card__pill">
            <span class="hero-prayer-card__pill-dot" aria-hidden="true"></span>
            <span class="hero-prayer-card__pill-text">الصلاة القادمة</span>
          </span>

          <h1 class="hero-prayer-card__name" data-hero-next-prayer-label>—</h1>
        </div>
      </div>

      ${renderHeroCountdown()}
    </article>
  `;
}

