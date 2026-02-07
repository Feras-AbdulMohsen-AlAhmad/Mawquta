// src/js/ui/render-prayers.js

export function renderTodayPrayers(containerEl, prayers, nextPrayerKey) {
  if (!containerEl) return;

  containerEl.innerHTML = "";

  for (const p of prayers) {
    const item = document.createElement("div");
    item.className =
      "list-group-item d-flex align-items-center justify-content-between";

    if (p.key === nextPrayerKey) item.classList.add("is-next");

    const left = document.createElement("div");
    left.className = "d-flex flex-column";

    const title = document.createElement("span");
    title.className = "fw-semibold";
    title.textContent = p.label;

    const sub = document.createElement("small");
    sub.className = "text-muted";
    sub.textContent = p.key;

    left.append(title, sub);

    const time = document.createElement("div");
    time.className = "fw-semibold";
    time.textContent = p.time;

    item.append(left, time);
    containerEl.append(item);
  }
}
