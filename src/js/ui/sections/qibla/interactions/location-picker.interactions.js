import {
  getCurrentCoords,
  reverseGeocodeToCityCountry,
} from "../../../../api/location.api.js";
import { searchCitySuggestions } from "../../../../services/location-search.service.js";
import { normalizeLocation } from "../../../../services/location.service.js";

function formatLocation(location) {
  if (!location) return "الموقع غير محدد";

  if (
    location.city === "Damascus" &&
    location.country === "Syria"
  ) {
    return "دمشق، سوريا";
  }

  return `${location.city}، ${location.country}`;
}

function setStatus(statusElement, message, isError = false) {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.classList.toggle("text-danger", isError);
}

function closePicker(modalElement) {
  const bootstrapApi = globalThis.bootstrap;
  if (!bootstrapApi?.Modal || !modalElement) return;

  bootstrapApi.Modal.getOrCreateInstance(modalElement).hide();
}

export function bindLocationPickerInteractions(
  rootDocument,
  locationService,
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
  const geolocationButton = modalElement.querySelector(
    "[data-location-geolocation]",
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

  function clearCandidate() {
    candidate = null;
    candidateSource = null;
    candidateRequestToken = null;
    if (candidateElement) {
      candidateElement.hidden = true;
      candidateElement.textContent = "";
    }
    if (confirmButton) confirmButton.disabled = true;
  }

  function presentCandidate(nextCandidate, source, requestToken = null) {
    candidate = normalizeLocation(nextCandidate, source);
    candidateSource = source;
    candidateRequestToken = requestToken;

    if (candidateElement) {
      candidateElement.textContent = `الموقع المقترح: ${formatLocation(candidate)}`;
      candidateElement.hidden = false;
    }
    if (confirmButton) confirmButton.disabled = false;
    setStatus(statusElement, "راجع الموقع المقترح ثم اضغط تأكيد الموقع.");
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
      button.className = "list-group-item list-group-item-action";
      button.setAttribute("role", "option");
      button.textContent = formatLocation(normalizedCandidate);
      button.addEventListener("click", () => {
        presentCandidate(normalizedCandidate, "user");
        for (const sibling of resultsElement.children) {
          sibling.setAttribute("aria-selected", String(sibling === button));
        }
      });
      resultsElement.append(button);
    }

    if (resultsElement.children.length === 0) {
      setStatus(
        statusElement,
        "لم تُعثر على نتيجة مكتملة مع منطقة زمنية موثوقة.",
        true,
      );
    } else {
      setStatus(statusElement, "اختر نتيجة ثم أكد الموقع.");
    }
  }

  async function runSearch(query, sequence, abortController) {
    setStatus(statusElement, "جارٍ البحث...");

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
        "تعذر الوصول إلى خدمة البحث. حاول مجددًا.",
        true,
      );
      return;
    }

    if (sequence !== searchSequence || abortController.signal.aborted) return;
    renderSearchResults(results);
  }

  function handleQueryInput() {
    const query = String(queryInput?.value || "").trim();
    searchSequence += 1;
    locationService.cancelPendingRequest();
    clearCandidate();
    resultsElement?.replaceChildren();

    if (searchTimer) globalThis.clearTimeout(searchTimer);
    searchAbortController?.abort();

    if (query.length < 3) {
      setStatus(statusElement, "أدخل ثلاثة أحرف على الأقل للبحث.");
      return;
    }

    const sequence = searchSequence;
    searchAbortController = new AbortController();
    searchTimer = globalThis.setTimeout(
      () => runSearch(query, sequence, searchAbortController),
      250,
    );
  }

  async function handleGeolocation() {
    clearCandidate();
    resultsElement?.replaceChildren();
    searchSequence += 1;
    searchAbortController?.abort();

    const requestToken = locationService.beginRequest();
    setStatus(statusElement, "بانتظار إذن الموقع وتحديد المنطقة الزمنية...");
    if (geolocationButton) geolocationButton.disabled = true;

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
    } catch (error) {
      locationService.failRequest(requestToken, error);
      setStatus(
        statusElement,
        "تعذر اعتماد موقع المتصفح أو منطقته الزمنية. بقي الموقع الحالي دون تغيير.",
        true,
      );
    } finally {
      if (geolocationButton) geolocationButton.disabled = false;
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
        );
        clearCandidate();
        return;
      }

      setStatus(statusElement, "تم اعتماد الموقع وحفظ اختيارك بأمان.");
      clearCandidate();
      closePicker(modalElement);
    } catch {
      setStatus(statusElement, "تعذر اعتماد الموقع المقترح.", true);
    }
  }

  function handleModalHidden() {
    searchSequence += 1;
    searchAbortController?.abort();
    if (searchTimer) globalThis.clearTimeout(searchTimer);
    locationService.cancelPendingRequest();
    clearCandidate();
    resultsElement?.replaceChildren();
    if (queryInput) queryInput.value = "";
    setStatus(
      statusElement,
      "ابحث عن مدينة أو استخدم موقع المتصفح بإذن صريح.",
    );
  }

  function handleModalShown() {
    globalThis.setTimeout(() => queryInput?.focus(), 0);
  }

  const unsubscribe = locationService.subscribe((state) => {
    if (state.location) {
      const label = formatLocation(state.location);
      for (const display of globalDisplays) display.textContent = label;
      if (currentElement) {
        currentElement.textContent = `الموقع المختار: ${label}`;
      }
    }
  });

  queryInput?.addEventListener("input", handleQueryInput);
  geolocationButton?.addEventListener("click", handleGeolocation);
  confirmButton?.addEventListener("click", handleConfirm);
  modalElement.addEventListener("hidden.bs.modal", handleModalHidden);
  modalElement.addEventListener("shown.bs.modal", handleModalShown);

  return () => {
    unsubscribe();
    searchSequence += 1;
    searchAbortController?.abort();
    if (searchTimer) globalThis.clearTimeout(searchTimer);
    queryInput?.removeEventListener("input", handleQueryInput);
    geolocationButton?.removeEventListener("click", handleGeolocation);
    confirmButton?.removeEventListener("click", handleConfirm);
    modalElement.removeEventListener("hidden.bs.modal", handleModalHidden);
    modalElement.removeEventListener("shown.bs.modal", handleModalShown);
  };
}
