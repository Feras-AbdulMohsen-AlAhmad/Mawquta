import { renderSectionHeadChip } from "../../../shared/components/section/section-head-chip.component.js";

export function renderHeaderCityChip(locationIconPath) {
  return renderSectionHeadChip({
    tagName: "button",
    rootClassName: "site-header__city",
    rootAttributes: {
      type: "button",
      "aria-label": "تغيير الموقع المختار",
      "data-bs-toggle": "modal",
      "data-bs-target": "#qiblaCityModal",
      "aria-controls": "qiblaCityModal",
      "data-global-location-control": true,
    },
    text: "دمشق، سوريا",
    textClassName: "site-header__city-text",
    textAttributes: {
      "data-global-location-display": true,
    },
    iconType: "image",
    iconClassName: "site-header__city-icon",
    iconSrc: locationIconPath,
    iconAlt: "",
  });
}
