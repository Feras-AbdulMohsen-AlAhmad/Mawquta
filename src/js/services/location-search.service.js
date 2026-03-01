export async function searchCitySuggestions(query, options = {}) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];

  const { maxRows = 8, lang = "en" } = options;

  const url = new URL("/api/geocode", window.location.origin);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(maxRows));
  url.searchParams.set("lang", lang);

  const r = await fetch(url.toString());
  const data = await r.json();

  if (!data?.ok) return [];
  return Array.isArray(data.results) ? data.results : [];
}
