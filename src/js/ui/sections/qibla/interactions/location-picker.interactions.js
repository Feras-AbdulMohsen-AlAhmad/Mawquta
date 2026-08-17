import {
  getCurrentCoords,
  reverseGeocodeToCityCountry,
} from "../../../../api/location.api.js";
import { searchCitySuggestions } from "../../../../services/location-search.service.js";
import { normalizeLocation } from "../../../../services/location.service.js";

function formatLocation(location) {
  if (!location) return "الموقع غير محدد";

  if (location.city === "Damascus" && location.country === "Syria") {
    return "دمشق، سوريا";
  }

  return `${location.city}، ${location.country}`;
}

function setStatus(statusElement, message, isError = false, state = "idle") {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.setAttribute("data-status", state);
  statusElement.classList.toggle("text-danger", isError);
}

export function bindLocationPickerInteractions(
  rootDocument,
  locationService,
  toastController = null,
) {
  const modalElement = rootDocument?.getElementById("qiblaCityModal");
  if (!modalElement || !locationService) return () => {};

  const queryInput = modalElement.querySelector("[data-location-query]");
  const resultsElement = modalElement.querySelector("[data-location-results]");
  const candidateElement = modalElement.querySelector(
    "[data-location-candidate]",
  );
  const statusElement = modalElement.querySelector("[data-location-status]");
  const currentElement = modalElement.querySelector("[data-location-current]");
  const confirmButton = modalElement.querySelector("[data-location-confirm]");
  const cancelButton = modalElement.querySelector("[data-location-cancel]");
  const clearButton = modalElement.querySelector("[data-location-clear]");
  const geolocationButton = modalElement.querySelector(
    "[data-location-geolocation]",
  );
  const modalTriggers = Array.from(
    rootDocument.querySelectorAll('[data-bs-target="#qiblaCityModal"]'),
  );
  const modalCloseButtons = Array.from(
    typeof modalElement.querySelectorAll === "function"
      ? modalElement.querySelectorAll('[data-bs-dismiss="modal"]')
      : [],
  );
  const globalDisplays = Array.from(
    rootDocument.querySelectorAll("[data-global-location-display]"),
  );

  let candidate = null;
  let candidateSource = null;
  let candidateRequestToken = null;
  let searchSequence = 0;
  let searchTimer = null;
  let searchAbortController = null;
  let isActive = true;
  let lastFocusedElement = null;
  let viewportListenersBound = false;
  const viewportTarget = rootDocument?.defaultView?.visualViewport || null;
  const windowTarget = rootDocument?.defaultView || globalThis;

  function isMobileViewport() {
    const width = Number(windowTarget?.innerWidth || 1024);
    return width <= 767.98;
  }

  function isModalOpen() {
    return modalElement.classList.contains("show");
  }

  function syncModalViewport() {
    if (!isModalOpen()) return;
    const top = Math.max(0, Number(viewportTarget?.offsetTop || 0));
    const height = Number(viewportTarget?.height || windowTarget?.innerHeight || 0);
    if (height > 0) {
      modalElement.style.setProperty(
        "--qibla-modal-viewport-top",
        `${top}px`,
      );
      modalElement.style.setProperty(
        "--qibla-modal-viewport-height",
        `${height}px`,
      );
      modalElement.style.setProperty(
        "--qibla-modal-available-height",
        `${height}px`,
      );

      if (isMobileViewport()) {
        modalElement.style.setProperty("top", `${top}px`);
        modalElement.style.setProperty("height", `${height}px`);
        modalElement.style.setProperty("bottom", "auto");

        const layoutHeight = Number(windowTarget?.innerHeight || height);
        const keyboardInset = Math.max(0, layoutHeight - (top + height));
        const keyboardThreshold = Math.min(120, layoutHeight * 0.15);
        const searchFocused = rootDocument.activeElement === queryInput;
        const hasSelection = modalElement.classList.contains(
          "qibla-city-modal--selected",
        );

        if (!hasSelection && (searchFocused || keyboardInset >= keyboardThreshold)) {
          modalElement.classList.add("qibla-city-modal--keyboard-open");
        } else if (!hasSelection && !searchFocused) {
          modalElement.classList.remove("qibla-city-modal--keyboard-open");
        }
      } else {
        modalElement.style.removeProperty("top");
        modalElement.style.removeProperty("height");
        modalElement.style.removeProperty("bottom");
        modalElement.classList.remove("qibla-city-modal--keyboard-open");
      }
    }
  }

  function bindModalViewport() {
    if (viewportListenersBound) {
      syncModalViewport();
      return;
    }
    viewportListenersBound = true;
    viewportTarget?.addEventListener?.("resize", syncModalViewport);
    viewportTarget?.addEventListener?.("scroll", syncModalViewport);
    windowTarget?.addEventListener?.("resize", syncModalViewport);
    windowTarget?.addEventListener?.("orientationchange", syncModalViewport);
    syncModalViewport();
  }

  function unbindModalViewport() {
    if (!viewportListenersBound) return;
    viewportListenersBound = false;
    viewportTarget?.removeEventListener?.("resize", syncModalViewport);
    viewportTarget?.removeEventListener?.("scroll", syncModalViewport);
    windowTarget?.removeEventListener?.("resize", syncModalViewport);
    windowTarget?.removeEventListener?.("orientationchange", syncModalViewport);
    modalElement.style.removeProperty("--qibla-modal-viewport-top");
    modalElement.style.removeProperty("--qibla-modal-viewport-height");
    modalElement.style.removeProperty("--qibla-modal-available-height");
    modalElement.style.removeProperty("top");
    modalElement.style.removeProperty("height");
    modalElement.style.removeProperty("bottom");
  }

  function clearCandidate() {
    candidate = null;
    candidateSource = null;
    candidateRequestToken = null;
    modalElement.classList.remove("qibla-city-modal--selected");
    if (candidateElement) {
      candidateElement.hidden = true;
      candidateElement.textContent = "";
    }
    if (confirmButton) confirmButton.disabled = true;
  }

  function syncClearButton() {
    if (clearButton) clearButton.hidden = !String(queryInput?.value || "").trim();
  }

  function presentCandidate(nextCandidate, source, requestToken = null) {
    candidate = normalizeLocation(nextCandidate, source);
    candidateSource = source;
    candidateRequestToken = requestToken;
    modalElement.classList.add("qibla-city-modal--selected");
    modalElement.classList.remove("qibla-city-modal--keyboard-open");
    if (isMobileViewport()) queryInput?.blur?.();

    if (candidateElement) {
      candidateElement.textContent = `الموقع المقترح: ${formatLocation(candidate)}`;
      candidateElement.hidden = false;
    }
    if (confirmButton) confirmButton.disabled = false;
    setStatus(statusElement, "راجع الموقع المقترح ثم اضغط تأكيد المدينة.", false, "selected");
  }

  function renderSearchResults(results) {
    if (!resultsElement) return;
    resultsElement.replaceChildren();

    for (const result of results) {
      let normalizedCandidate;
      try {
        normalizedCandidate = normalizeLocation(
          {
            type: "city",
            city: result.city,
            country: result.country,
            latitude: result.lat,
            longitude: result.lon,
            timezone: result.timezone,
          },
          "user",
        );
      } catch {
        continue;
      }

      const button = rootDocument.createElement("button");
      button.type = "button";
      button.className = "qibla-city-modal__result";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      if (!button.ownerDocument) {
        button.textContent = formatLocation(normalizedCandidate);
      }
      button.setAttribute(
        "aria-label",
        `${normalizedCandidate.city}، ${normalizedCandidate.country}`,
      );

      const icon = rootDocument.createElement("span");
      icon.className = "qibla-city-modal__result-icon";
      icon.setAttribute("aria-hidden", "true");

      const copy = rootDocument.createElement("span");
      copy.className = "qibla-city-modal__result-copy";

      const city = rootDocument.createElement("span");
      city.className = "qibla-city-modal__result-city";
      city.textContent = normalizedCandidate.city;

      const country = rootDocument.createElement("span");
      country.className = "qibla-city-modal__result-country";
      country.textContent = normalizedCandidate.country;

      const check = rootDocument.createElement("span");
      check.className = "qibla-city-modal__result-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";

      copy.append(city);
      copy.append(country);
      button.append(icon);
      button.append(copy);
      button.append(check);
      button.addEventListener("click", () => {
        presentCandidate(normalizedCandidate, "user");
        for (const sibling of resultsElement.children) {
          sibling.setAttribute("aria-selected", String(sibling === button));
          sibling.classList.toggle("is-selected", sibling === button);
        }
      });
      resultsElement.append(button);
    }

    if (resultsElement.children.length === 0) {
      setStatus(
        statusElement,
        "لم يتم العثور على مدن مطابقة\nتحقق من اسم المدينة وحاول مرة أخرى",
        false,
        "empty",
      );
    } else {
      setStatus(statusElement, "اختر نتيجة لمراجعتها ثم أكد المدينة.", false, "success");
    }
  }

  async function runSearch(query, sequence, abortController) {
    setStatus(statusElement, "جارٍ البحث عن المدن...", false, "loading");
    if (queryInput) queryInput.setAttribute("aria-busy", "true");

    let results;
    try {
      results = await searchCitySuggestions(query, {
        lang: "ar",
        signal: abortController.signal,
      });
    } catch {
      if (sequence !== searchSequence || abortController.signal.aborted) return;
      resultsElement?.replaceChildren();
      setStatus(
        statusElement,
        "تعذر البحث عن المدن الآن\nتحقق من اتصالك ثم حاول مجددًا.",
        true,
        "error",
      );
      if (queryInput) queryInput.setAttribute("aria-busy", "false");
      return;
    }

    if (sequence !== searchSequence || abortController.signal.aborted) return;
    renderSearchResults(results);
    if (queryInput) queryInput.setAttribute("aria-busy", "false");
  }

  function handleQueryInput() {
    const query = String(queryInput?.value || "").trim();
    searchSequence += 1;
    locationService.cancelPendingRequest();
    clearCandidate();
    resultsElement?.replaceChildren();
    syncClearButton();

    if (searchTimer) globalThis.clearTimeout(searchTimer);
    searchAbortController?.abort();

    if (query.length < 3) {
      setStatus(statusElement, "أدخل ثلاثة أحرف على الأقل للبحث.", false, "idle");
      queryInput?.setAttribute("aria-busy", "false");
      return;
    }

    const sequence = searchSequence;
    searchAbortController = new AbortController();
    searchTimer = globalThis.setTimeout(
      () => runSearch(query, sequence, searchAbortController),
      250,
    );
  }

  function handleClear() {
    if (!queryInput) return;
    queryInput.value = "";
    queryInput.focus();
    handleQueryInput();
  }

  async function handleGeolocation() {
    if (!isActive) return;

    clearCandidate();
    resultsElement?.replaceChildren();
    searchSequence += 1;
    searchAbortController?.abort();

    const requestToken = locationService.beginRequest();
    setStatus(statusElement, "بانتظار إذن الموقع وتحديد المنطقة الزمنية...", false, "loading");
    if (geolocationButton) {
      geolocationButton.disabled = true;
      geolocationButton.setAttribute("aria-busy", "true");
    }

    try {
      const coordinates = await getCurrentCoords();
      if (!locationService.isRequestCurrent(requestToken)) return;

      const resolved = await reverseGeocodeToCityCountry(
        coordinates.latitude,
        coordinates.longitude,
        "ar",
      );
      if (!locationService.isRequestCurrent(requestToken)) return;

      const nextCandidate = {
        type: "coords",
        city: resolved.city,
        country: resolved.country,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timezone: resolved.timezone,
      };

      presentCandidate(nextCandidate, "geolocation", requestToken);
      locationService.completeCandidateRequest(requestToken);
      toastController?.show("success", "تم تحديد موقعك. راجعه ثم أكد الاختيار.", { key: "geolocation-success" });
    } catch (error) {
      locationService.failRequest(requestToken, error);
      if (locationService.isRequestCurrent(requestToken)) {
        setStatus(
          statusElement,
          "تعذر اعتماد موقع المتصفح أو منطقته الزمنية. بقي الموقع الحالي دون تغيير.",
          true,
          "error",
        );
        toastController?.show("error", "تعذر تحديد موقعك. بقي الموقع الحالي دون تغيير.", { key: "geolocation-error" });
      }
    } finally {
      if (
        isActive &&
        locationService.isRequestCurrent(requestToken) &&
        geolocationButton
      ) {
        geolocationButton.disabled = false;
        geolocationButton.setAttribute("aria-busy", "false");
      }
    }
  }

  function handleConfirm() {
    if (!candidate || !candidateSource) return;

    try {
      const accepted = locationService.acceptLocation(
        candidate,
        candidateSource,
        candidateRequestToken,
      );
      if (!accepted) {
        setStatus(
          statusElement,
          "انتهت صلاحية الموقع المقترح بسبب اختيار أحدث.",
          true,
          "error",
        );
        clearCandidate();
        return;
      }

      setStatus(statusElement, "تم اعتماد الموقع وحفظ اختيارك بأمان.");
      toastController?.show("success", "تم اعتماد الموقع بنجاح.", { key: "location-accepted" });
      clearCandidate();
      closePicker(modalElement);
    } catch {
      setStatus(statusElement, "تعذر اعتماد الموقع المقترح.", true, "error");
    }
  }

  function handleModalHidden() {
    unbindModalViewport();
    modalElement.classList.remove(
      "qibla-city-modal--keyboard-open",
      "qibla-city-modal--selected",
    );
    searchSequence += 1;
    searchAbortController?.abort();
    if (searchTimer) globalThis.clearTimeout(searchTimer);
    locationService.cancelPendingRequest();
    clearCandidate();
    resultsElement?.replaceChildren();
    if (queryInput) queryInput.value = "";
    syncClearButton();
    setStatus(statusElement, "ابحث عن مدينة للبدء\nيمكنك البحث بالعربية أو الإنجليزية", false, "idle");
  }

  function handleModalShown() {
    bindModalViewport();
    syncModalViewport();
    if (!isMobileViewport()) {
      const focusDesktopSearch = () => {
        if (isModalOpen() && !isMobileViewport()) {
          queryInput?.focus({ preventScroll: true });
        }
      };
      if (typeof windowTarget?.requestAnimationFrame === "function") {
        windowTarget.requestAnimationFrame(focusDesktopSearch);
      } else {
        focusDesktopSearch();
      }
    }
  }

  function handleQueryFocus() {
    if (!isModalOpen() || !isMobileViewport()) return;
    syncModalViewport();
    modalElement.classList.add("qibla-city-modal--keyboard-open");
  }

  function handleQueryBlur() {
    if (!isMobileViewport() || modalElement.classList.contains("qibla-city-modal--selected")) return;
    if (typeof windowTarget?.requestAnimationFrame === "function") {
      windowTarget.requestAnimationFrame(syncModalViewport);
    } else {
      syncModalViewport();
    }
  }

  function handleModalTransitionEnd(event) {
    if (
      event.target === modalElement &&
      event.propertyName === "opacity" &&
      isModalOpen() &&
      !isMobileViewport()
    ) {
      queryInput?.focus({ preventScroll: true });
    }
  }

  function openPicker(event) {
    if (typeof event?.preventDefault === "function") event.preventDefault();
    lastFocusedElement = event?.currentTarget || rootDocument.activeElement;
    modalElement.classList.add("show");
    modalElement.setAttribute("aria-hidden", "false");
    rootDocument.body.classList.add("modal-open");
    handleModalShown();
  }

  function closePicker(event) {
    if (typeof event?.preventDefault === "function") event.preventDefault();
    modalElement.classList.remove("show");
    modalElement.setAttribute("aria-hidden", "true");
    rootDocument.body.classList.remove("modal-open");
    handleModalHidden();
    lastFocusedElement?.focus?.({ preventScroll: true });
    lastFocusedElement = null;
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePicker(event);
      return;
    }

    if (event.key !== "Tab" || !modalElement.classList.contains("show")) {
      return;
    }

    const focusable = Array.from(
      modalElement.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && rootDocument.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && rootDocument.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleModalBackdropClick(event) {
    if (event.target === modalElement) closePicker(event);
  }

  modalTriggers.forEach((trigger) => trigger.addEventListener("click", openPicker));
  modalCloseButtons.forEach((button) => button.addEventListener("click", closePicker));
  modalElement.addEventListener("click", handleModalBackdropClick);
  modalElement.addEventListener("keydown", handleModalKeydown);
  modalElement.addEventListener("transitionend", handleModalTransitionEnd);

  const unsubscribe = locationService.subscribe((state) => {
    if (state.location) {
      const label = formatLocation(state.location);
      for (const display of globalDisplays) display.textContent = label;
      if (currentElement) {
      currentElement.textContent = label;
      }
    }
  });

  queryInput?.addEventListener("input", handleQueryInput);
  queryInput?.addEventListener("focus", handleQueryFocus);
  queryInput?.addEventListener("blur", handleQueryBlur);
  clearButton?.addEventListener("click", handleClear);
  cancelButton?.addEventListener("click", closePicker);
  geolocationButton?.addEventListener("click", handleGeolocation);
  confirmButton?.addEventListener("click", handleConfirm);
  modalElement.addEventListener("hidden.bs.modal", handleModalHidden);
  modalElement.addEventListener("shown.bs.modal", handleModalShown);

  return () => {
    isActive = false;
    unbindModalViewport();
    unsubscribe();
    searchSequence += 1;
    searchAbortController?.abort();
    if (searchTimer) globalThis.clearTimeout(searchTimer);
    locationService.cancelPendingRequest();
    queryInput?.removeEventListener("input", handleQueryInput);
    queryInput?.removeEventListener("focus", handleQueryFocus);
    queryInput?.removeEventListener("blur", handleQueryBlur);
    clearButton?.removeEventListener("click", handleClear);
    cancelButton?.removeEventListener("click", closePicker);
    geolocationButton?.removeEventListener("click", handleGeolocation);
    confirmButton?.removeEventListener("click", handleConfirm);
    modalTriggers.forEach((trigger) => trigger.removeEventListener("click", openPicker));
    modalCloseButtons.forEach((button) => button.removeEventListener("click", closePicker));
    modalElement.removeEventListener("click", handleModalBackdropClick);
    modalElement.removeEventListener("keydown", handleModalKeydown);
    modalElement.removeEventListener("transitionend", handleModalTransitionEnd);
    modalElement.removeEventListener("hidden.bs.modal", handleModalHidden);
    modalElement.removeEventListener("shown.bs.modal", handleModalShown);
  };
}
