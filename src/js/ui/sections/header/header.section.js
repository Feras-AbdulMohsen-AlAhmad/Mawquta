import { HEADER_ICON_PATHS } from "./components/header-icon-paths.constants.js";
import { renderHeaderBrand } from "./components/header-brand.component.js";
import { renderHeaderMenuToggle } from "./components/header-menu-toggle.component.js";
import { renderHeaderNavigation } from "./components/header-navigation.component.js";

export function renderHeaderSection(rootElement, sectionData = {}) {
  void sectionData;

  if (!rootElement) {
    return null;
  }

  rootElement.innerHTML = `
    <div class="container-xl">
      <div class="site-header__inner">
        ${renderHeaderBrand(HEADER_ICON_PATHS.brandLogo)}
        ${renderHeaderMenuToggle(HEADER_ICON_PATHS.menu)}
        ${renderHeaderNavigation(HEADER_ICON_PATHS)}
      </div>
    </div>
  `;

  return rootElement;
}
