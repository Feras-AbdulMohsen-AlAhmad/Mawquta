export function renderHeaderMenuToggle(menuIconPath) {
  return `
    <button
      type="button"
      class="site-header__menu-toggle header-menu-toggle ms-auto d-lg-none"
      id="navToggle"
      aria-label="فتح القائمة"
      aria-controls="siteNav"
      aria-expanded="false"
    >
      <img class="header-menu-toggle__icon" src="${menuIconPath}" alt="" width="24" height="24" />
    </button>
  `;
}

