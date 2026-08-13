function renderFooterSocialItem(item) {
  const content = `
    <img src="${item.iconPath}" alt="" aria-hidden="true" />
    <span>${item.label}</span>
  `;

  if (!item.href) {
    return `<span class="footer-social-inline__item" aria-label="${item.ariaLabel}">${content}</span>`;
  }

  return `
    <a class="footer-social-inline__item" href="${item.href}" aria-label="${item.ariaLabel}" target="_blank" rel="noreferrer noopener">
      ${content}
    </a>
  `;
}

export function renderFooterSocialLinks(iconPaths) {
  const socialLinks = [
    {
      href: null,
      ariaLabel: "Instagram",
      iconPath: iconPaths.instagram,
      label: "@firas_a7mad",
    },
    {
      href: null,
      ariaLabel: "LinkedIn",
      iconPath: iconPaths.linkedin,
      label: "Firas AL-Ahmad",
    },
    {
      href: null,
      ariaLabel: "GitHub",
      iconPath: iconPaths.github,
      label: "Firas AL-Ahmad",
    },
  ];

  return `
    <div class="footer-social-inline" aria-label="وسائل التواصل الاجتماعي">
      ${socialLinks.map((item) => renderFooterSocialItem(item)).join("\n")}
    </div>
  `;
}
