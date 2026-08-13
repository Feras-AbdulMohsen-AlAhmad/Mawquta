import { renderFooterBrand } from "./footer-brand.component.js";
import { renderFooterContactColumn } from "./footer-contact-column.component.js";
import { renderFooterLinksColumn } from "./footer-links-column.component.js";

const FOOTER_SITE_LINKS = [
  { href: "#prayer-section", label: "مواقيت الصلاة" },
  { href: "#qibla-section", label: "القبلة" },
  { href: "#ramadan-section", label: "رمضان" },
];

export function renderFooterMainContent(iconPaths) {
  return `
    <div class="footer-content container-xl">
      <div class="footer-main-grid">
        ${renderFooterBrand(iconPaths)}

        <div class="footer-main-col-group">
          ${renderFooterContactColumn(iconPaths)}

          ${renderFooterLinksColumn({
            modifierClass: "footer-main-col--links",
            heading: "الروابط",
            links: FOOTER_SITE_LINKS,
          })}
        </div>
      </div>

      <p class="footer-legal-note">قد تختلف المواقيت المعروضة قليلًا حسب المدينة المختارة والجهة المحلية المعتمدة.</p>
    </div>
  `;
}
