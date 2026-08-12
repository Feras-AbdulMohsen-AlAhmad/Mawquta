function renderHeaderLanguageOption(option) {
  const selectedClass = option.isSelected ? " is-selected" : "";
  const ariaSelected = option.isSelected ? "true" : "false";

  return `
    <button
      type="button"
      class="header-language__option${selectedClass}"
      role="option"
      aria-selected="${ariaSelected}"
      data-lang-option
      data-lang-value="${option.value}"
      data-lang-label="${option.label}"
      data-lang-code="${option.code}"
      data-lang-flag="${option.flagPath}"
    >
      <img
        class="header-language__flag"
        src="${option.flagPath}"
        alt=""
        width="20"
        height="15"
        loading="lazy"
        decoding="async"
      />
      <span class="header-language__option-label">${option.label}</span>
      <span class="header-language__option-code">${option.code}</span>
    </button>
  `;
}

export function renderHeaderLanguageDropdown({
  currentLanguage,
  options,
  menuId = "headerLanguageMenu",
  chevronPath,
}) {
  return `
    <div class="header-language" data-lang-dropdown>
      <button
        type="button"
        class="header-chip header-language__trigger"
        aria-label="اختيار اللغة"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="${menuId}"
        data-lang-trigger
      >
        <img
          class="header-language__flag"
          src="${currentLanguage.flagPath}"
          alt=""
          width="20"
          height="15"
          loading="lazy"
          decoding="async"
          data-lang-flag
        />
        <span class="header-language__label" data-lang-label>${currentLanguage.label}</span>
        <span class="header-language__code" data-lang-code>${currentLanguage.code}</span>
        <img class="header-language__chevron" src="${chevronPath}" alt="" width="12" height="12" aria-hidden="true" />
      </button>

      <div
        class="header-language__menu"
        id="${menuId}"
        role="listbox"
        aria-label="قائمة اللغات"
        data-lang-menu
        hidden
      >
        ${options.map((option) => renderHeaderLanguageOption(option)).join("\n")}
      </div>
    </div>
  `;
}

