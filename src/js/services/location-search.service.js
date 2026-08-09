import { CONFIG } from "../config/app.config.js";

export async function searchCitySuggestions(query, options = {}) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];

  const {
    maxRows = 8,
    lang = CONFIG.LOCALE.split("-")[0],
    signal,
  } = options;

  let response;
  try {
    const url = new URL("/api/geocode", window.location.origin);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", String(maxRows));
    url.searchParams.set("lang", lang);

    response = await fetch(url.toString(), { signal });
  } catch (error) {
    // Aborts are benign: the caller already invalidated this request through
    // its own sequence guard. Every other failure is a real, recoverable error.
    if (error?.name === "AbortError" || signal?.aborted) {
      return [];
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`geocode request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.ok) {
    throw new Error("geocode response failed");
  }

  return Array.isArray(data.results) ? data.results : [];
}
