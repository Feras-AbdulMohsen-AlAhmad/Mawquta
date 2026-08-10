// Hero / countdown tests for the S4-T7 Daily contract integration.
// The Hero consumes the Daily contract only (via the runtime's
// updateHeroSectionLiveState). These tests verify the markup exposes the
// live-data hooks and that updateHeroSectionLiveState drives them correctly.

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const heroUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/hero/hero.section.js",
).href;
const cardUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/hero/components/hero-next-prayer-card.component.js",
).href;
const countdownUrl = pathToFileURL(
  new URL("../../src/js", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/") + "/ui/sections/hero/components/hero-countdown.component.js",
).href;

const { updateHeroSectionLiveState } = await import(heroUrl);
const { renderHeroNextPrayerCard } = await import(cardUrl);
const { renderHeroCountdown } = await import(countdownUrl);

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
    this.children = new Map();
  }
  querySelector(selector) {
    if (!this.children.has(selector)) {
      this.children.set(selector, new FakeElement());
    }
    return this.children.get(selector);
  }
}

await checkAsync("HC-01", async () => {
  // The hero next-prayer card exposes every live-data hook the runtime needs.
  const markup = renderHeroNextPrayerCard();
  const hooks = [
    "data-hero-next-prayer-time",
    "data-hero-next-prayer-label",
    "data-hero-countdown-hours",
    "data-hero-countdown-minutes",
    "data-hero-countdown-seconds",
  ];
  for (const hook of hooks) {
    assert.ok(markup.includes(hook), `markup exposes ${hook}`);
  }
});

await checkAsync("HC-02", async () => {
  // updateHeroSectionLiveState drives all five live fields from a contract.
  const root = new FakeElement();
  updateHeroSectionLiveState(root, {
    nextPrayerLabel: "العصر",
    nextPrayerTime: "15:45",
    hours: "00",
    minutes: "00",
    seconds: "05",
  });

  assert.equal(root.querySelector("[data-hero-next-prayer-label]").textContent, "العصر");
  assert.equal(root.querySelector("[data-hero-next-prayer-time]").textContent, "15:45");
  assert.equal(root.querySelector("[data-hero-countdown-hours]").textContent, "00");
  assert.equal(root.querySelector("[data-hero-countdown-minutes]").textContent, "00");
  assert.equal(root.querySelector("[data-hero-countdown-seconds]").textContent, "05");
});

await checkAsync("HC-03", async () => {
  // Omitted fields are left untouched (no overwrite with undefined/empty).
  const root = new FakeElement();
  updateHeroSectionLiveState(root, { nextPrayerTime: "18:30" });

  assert.equal(root.querySelector("[data-hero-next-prayer-time]").textContent, "18:30");
  assert.equal(root.querySelector("[data-hero-next-prayer-label]").textContent, "");
  assert.equal(root.querySelector("[data-hero-countdown-seconds]").textContent, "");
});

await checkAsync("HC-04", async () => {
  // updateHeroSectionLiveState is safe with a missing root and preserves the
  // HH:MM wall-clock format of a contract time.
  assert.equal(updateHeroSectionLiveState(null, { nextPrayerTime: "05:00" }), null);

  const root = new FakeElement();
  updateHeroSectionLiveState(root, { nextPrayerTime: "05:00" });
  assert.match(
    root.querySelector("[data-hero-next-prayer-time]").textContent,
    /^([01]\d|2[0-3]):[0-5]\d$/,
  );
});

await checkAsync("HC-05", async () => {
  // Countdown markup: three live value hooks, polite aria-live, no AM/PM.
  const markup = renderHeroCountdown();
  assert.ok(markup.includes('aria-live="polite"'), "polite live region");
  for (const hook of [
    "data-hero-countdown-hours",
    "data-hero-countdown-minutes",
    "data-hero-countdown-seconds",
  ]) {
    assert.ok(markup.includes(hook), `countdown exposes ${hook}`);
  }
  assert.ok(!markup.includes("PM"), "no static PM fixture in countdown");
});

await checkAsync("HC-06", async () => {
  // Full hero card integration: F2 neutral placeholders in the static markup
  // (--:-- / —, no AM/PM, no hardcoded prayer label), replaced by live state.
  const markup = renderHeroNextPrayerCard();
  assert.ok(markup.includes("--:--"), "neutral time placeholder in static markup");
  assert.ok(markup.includes(">—<") || markup.includes("&#8212;"), "neutral label placeholder in static markup");
  assert.ok(!markup.includes("PM"), "no static PM fixture");
  assert.ok(!markup.includes("15:42"), "no static time fixture");

  const root = new FakeElement();
  root.innerHTML = markup;
  updateHeroSectionLiveState(root, {
    nextPrayerLabel: "المغرب",
    nextPrayerTime: "18:30",
    hours: "01",
    minutes: "02",
    seconds: "03",
  });

  assert.equal(root.querySelector("[data-hero-next-prayer-label]").textContent, "المغرب");
  assert.equal(root.querySelector("[data-hero-next-prayer-time]").textContent, "18:30");
  assert.equal(root.querySelector("[data-hero-countdown-seconds]").textContent, "03");
  assert.ok(
    !root.querySelector("[data-hero-next-prayer-time]").textContent.includes("PM"),
    "live time no longer carries the PM fixture",
  );
});

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`HERO_SUMMARY pass=${passed} fail=${failed.length} total=${results.length}`);
if (failed.length > 0) {
  console.error("Failed:", failed.map((r) => r.id).join(", "));
  process.exit(1);
} else {
  process.exit(0);
}
