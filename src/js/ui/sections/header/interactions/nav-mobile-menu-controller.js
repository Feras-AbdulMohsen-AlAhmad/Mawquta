import {
  COLLAPSE_SCROLL_FALLBACK_MS,
  MOBILE_FALLBACK_WIDTH,
  MOBILE_MEDIA_QUERY,
} from "./nav.constants.js";
import { getHeaderHeight } from "./nav.helpers.js";

function createNoopController() {
  return {
    isMobileViewport: () => false,
    isPanelOpen: () => false,
    closeMenu: () => {},
    closeThen: (callback) => callback?.(),
  };
}

function getMenuElements(headerRoot) {
  const menuToggleButton = headerRoot.querySelector(".site-header__menu-toggle");
  const panelElement = headerRoot.querySelector(".site-header__panel");
  const navElement = headerRoot.querySelector(".site-header__nav");
  const usesBootstrapPanel =
    panelElement instanceof HTMLElement &&
    panelElement.classList.contains("collapse");
  const menuContainer = usesBootstrapPanel ? panelElement : navElement;

  return {
    menuToggleButton,
    menuContainer,
    usesBootstrapPanel,
  };
}

function syncHeaderOffset(headerRoot) {
  const headerHeight = `${getHeaderHeight()}px`;
  headerRoot.style.setProperty("--header-offset", headerHeight);
  document.documentElement.style.setProperty("--app-header-height", headerHeight);
}

function createViewportMatcher() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_MEDIA_QUERY)
    : null;
}

function createBootstrapCollapse(menuContainer, usesBootstrapPanel) {
  if (!usesBootstrapPanel || !window.bootstrap?.Collapse) {
    return null;
  }

  return window.bootstrap.Collapse.getOrCreateInstance(menuContainer, {
    toggle: false,
  });
}

function isMenuOpen(menuContainer, bootstrapCollapse) {
  return bootstrapCollapse
    ? menuContainer.classList.contains("show")
    : menuContainer.classList.contains("is-open");
}

export function createMobileMenuController(headerRoot) {
  const { menuToggleButton, menuContainer, usesBootstrapPanel } =
    getMenuElements(headerRoot);

  if (!menuToggleButton || !(menuContainer instanceof HTMLElement)) {
    return createNoopController();
  }

  const mediaQueryList = createViewportMatcher();
  const bootstrapCollapse = createBootstrapCollapse(
    menuContainer,
    usesBootstrapPanel,
  );

  const isMobileViewport = () => {
    if (mediaQueryList) {
      return Boolean(mediaQueryList.matches);
    }

    return window.innerWidth <= MOBILE_FALLBACK_WIDTH;
  };

  const closeMenu = () => {
    if (bootstrapCollapse) {
      bootstrapCollapse.hide();
      return;
    }

    menuToggleButton.setAttribute("aria-expanded", "false");
    menuContainer.classList.remove("show", "is-open");
    menuToggleButton.focus({ preventScroll: true });
  };

  if (!bootstrapCollapse) {
    menuToggleButton.addEventListener("click", (event) => {
      event.preventDefault();
      syncHeaderOffset(headerRoot);

      const isExpanded = menuToggleButton.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        closeMenu();
      } else {
        menuToggleButton.setAttribute("aria-expanded", "true");
        menuContainer.classList.add("is-open");
        const firstLink = menuContainer.querySelector(".site-header__link");
        if (firstLink instanceof HTMLElement) {
          firstLink.focus({ preventScroll: true });
        }
      }
    });
  } else {
    menuContainer.addEventListener("shown.bs.collapse", () => {
      menuToggleButton.setAttribute("aria-expanded", "true");
    });

    menuContainer.addEventListener("hidden.bs.collapse", () => {
      menuToggleButton.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("click", (event) => {
    if (!isMobileViewport()) {
      return;
    }

    const eventTarget = event.target;
    if (!(eventTarget instanceof Node)) {
      return;
    }

    if (!headerRoot.contains(eventTarget) && isMenuOpen(menuContainer, bootstrapCollapse)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  if (mediaQueryList && typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", () => {
      if (!isMobileViewport()) {
        closeMenu();
      } else {
        syncHeaderOffset(headerRoot);
      }
    });
  }

  window.addEventListener("resize", () => syncHeaderOffset(headerRoot), {
    passive: true,
  });
  syncHeaderOffset(headerRoot);

  const closeThen = (callback) => {
    if (!isMenuOpen(menuContainer, bootstrapCollapse)) {
      callback?.();
      return;
    }

    if (!bootstrapCollapse) {
      closeMenu();
      callback?.();
      return;
    }

    let handled = false;
    const runOnce = () => {
      if (handled) {
        return;
      }

      handled = true;
      callback?.();
    };

    menuContainer.addEventListener("hidden.bs.collapse", runOnce, {
      once: true,
    });

    closeMenu();
    window.setTimeout(runOnce, COLLAPSE_SCROLL_FALLBACK_MS);
  };

  return {
    isMobileViewport,
    isPanelOpen: () => isMenuOpen(menuContainer, bootstrapCollapse),
    closeMenu,
    closeThen,
  };
}
