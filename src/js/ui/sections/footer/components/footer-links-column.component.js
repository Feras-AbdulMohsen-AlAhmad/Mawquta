function renderFooterLinkItem(linkItem) {
  if (!linkItem.href) {
    return `<li><span>${linkItem.label}</span></li>`;
  }

  return `<li><a href="${linkItem.href}">${linkItem.label}</a></li>`;
}

export function renderFooterLinksColumn({ modifierClass, heading, links }) {
  return `
    <div class="footer-main-col ${modifierClass}">
      <p class="footer-heading">${heading}</p>
      <ul class="footer-links">
        ${links.map((linkItem) => renderFooterLinkItem(linkItem)).join("\n")}
      </ul>
    </div>
  `;
}
