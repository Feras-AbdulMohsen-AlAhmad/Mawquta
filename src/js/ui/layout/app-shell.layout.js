export function renderAppShell(rootElement) {
  if (!rootElement) {
    return null;
  }

  rootElement.innerHTML = `
    <div class="page-shell" id="app-shell">
      <header class="site-header" id="site-header" data-mount="header"></header>

      <main class="page-main" id="main-content">
        <section id="hero-section" data-mount="hero-section"></section>
        <section id="prayer-section" data-mount="daily-prayer-section"></section>
        <section id="weekly-prayer-section" data-mount="weekly-prayer-section"></section>
        <section id="qibla-section" data-mount="qibla-section"></section>
        <section id="ramadan-section" data-mount="ramadan-section"></section>
      </main>

      <footer class="site-footer" id="site-footer" data-mount="footer"></footer>
      <div id="app-toast-region" class="toast-region" aria-live="polite" aria-atomic="false"></div>
    </div>
  `;

  return rootElement.querySelector("#app-shell");
}
