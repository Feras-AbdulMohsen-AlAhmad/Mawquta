export function renderCitySuggestions(containerEl, suggestions, onPick) {
  if (!containerEl) return;

  if (!suggestions || suggestions.length === 0) {
    containerEl.innerHTML = "";
    return;
  }

  containerEl.innerHTML = suggestions
    .map(
      (s, idx) => `
      <button type="button"
        class="list-group-item list-group-item-action"
        data-idx="${idx}"
        dir="ltr">
        ${s.label}
      </button>
    `,
    )
    .join("");

  containerEl.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.idx);
      const picked = suggestions[i];
      if (picked && typeof onPick === "function") onPick(picked);
    });
  });
}
