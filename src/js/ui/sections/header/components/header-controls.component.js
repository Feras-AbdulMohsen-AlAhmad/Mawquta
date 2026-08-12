import { renderHeaderCityChip } from "./header-city-chip.component.js";
import { renderHeaderLanguageDropdown } from "./header-language-dropdown.component.js";
import { renderHeaderThemeToggle } from "./header-theme-toggle.component.js";

export function renderHeaderControls(iconPaths) {
  const currentLanguage = {
    value: "ar",
    label: "العربية",
    code: "SY",
    flagPath: iconPaths.flagSy,
  };

  const languageOptions = [
    {
      value: "ar",
      label: "العربية",
      code: "SY",
      flagPath: iconPaths.flagSy,
      isSelected: true,
    },
    {
      value: "en",
      label: "English",
      code: "US",
      flagPath: iconPaths.flagUs,
      isSelected: false,
    },
  ];

  return `
    <div class="site-header__controls">
      ${renderHeaderCityChip(iconPaths.location)}
      ${renderHeaderLanguageDropdown({
        currentLanguage,
        options: languageOptions,
        chevronPath: iconPaths.chevron,
      })}
      ${renderHeaderThemeToggle(iconPaths.moon)}
    </div>
  `;
}
