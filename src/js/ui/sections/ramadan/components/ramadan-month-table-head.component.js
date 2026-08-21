import { renderSectionHeadChip } from "../../../shared/components/section/section-head-chip.component.js";

function renderRamadanTableHeadChip(iconPaths) {
  const chipItems = [
    '<span data-rt-head-hijri>—</span>هـ',
    '<span data-rt-head-gregorian>—</span>م',
    "رمضان",
  ];
  const chipText = chipItems.join(" ");

  return renderSectionHeadChip({
    tagName: "span",
    rootClassName: "ramadan-table-head__chip",
    text: chipText,
    iconType: "image",
    iconSrc: iconPaths.ramadan,
    iconAlt: "",
  });
}

function renderRamadanTableHeadActions(iconPaths) {
  const actionButtons = [
    {
      label: "تحميل",
      iconPath: iconPaths.download,
    },
    {
      label: "مشاركة",
      iconPath: iconPaths.share,
    },
  ];

  return `
    <div class="ramadan-table-head__actions" aria-label="إجراءات الجدول">
      ${actionButtons
        .map(
          (actionButton, actionIndex) =>
            `<button type="button" class="ramadan-table-action" data-ramadan-tab data-ramadan-table-action aria-selected="${actionIndex === 0 ? "true" : "false"}" aria-disabled="true" aria-label="${actionButton.label} (غير متاح حاليًا)" title="غير متاح حاليًا" disabled><span>${actionButton.label}</span><img src="${actionButton.iconPath}" alt="" loading="lazy" decoding="async" /></button>`,
        )
        .join("\n")}
    </div>
  `;
}

export function renderRamadanMonthTableHead(iconPaths) {
  return `
    <div class="ramadan-table-head">
      <div class="ramadan-table-head__content">
        ${renderRamadanTableHeadChip(iconPaths)}
        <h2 class="ramadan-table-title">إمساكية شهر رمضان</h2>
      </div>

      ${renderRamadanTableHeadActions(iconPaths)}
    </div>
  `;
}
