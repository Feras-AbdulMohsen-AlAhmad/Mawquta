import { renderQiblaVisual } from "./components/qibla-visual.component.js";
import { renderQiblaCardHead } from "./components/qibla-card-head.component.js";
import { renderQiblaCityModal } from "./components/qibla-city-modal.component.js";
import { renderSectionDivider } from "../../shared/components/section/section-divider.component.js";

export function renderQiblaSection(rootElement, sectionData = {}) {
  if (!rootElement) {
    return null;
  }

  const modalId = "qiblaCityModal";
  const modalLabelId = "qiblaCityModalTitle";

  rootElement.innerHTML = `
    <section class="qibla-section" id="qibla" aria-label="اتجاه القبلة">
      <div class="container-xl">
        <div class="qibla-card">
          ${renderQiblaCardHead(modalId, sectionData)}

          ${renderQiblaVisual()}

          <div class="qibla-card__data" data-qibla-data></div>
        </div>
      </div>

      ${renderQiblaCityModal({ modalId, modalLabelId })}
    </section>

    ${renderSectionDivider()}
  `;

  return rootElement;
}
