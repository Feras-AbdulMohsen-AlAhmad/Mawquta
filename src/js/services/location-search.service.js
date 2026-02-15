import { searchCitiesGeoNames } from "../api/geonames.api.js";
import { requireValue } from "../utils/validation.util.js";

function normalizeQuery(value) {
  return String(value || "").trim();
}

// Main function to search for city suggestions based on user input
function toSuggestion(item) {
  const city = item?.name || "";
  const country = item?.countryName || "";
  const lat = Number(item?.lat);
  const lon = Number(item?.lng);

  return {
    label: country ? `${city}, ${country}` : city,
    city,
    country,
    lat,
    lon,
  };
}

export async function searchCitySuggestions(query) {
  const q = normalizeQuery(query);
  requireValue(q, "query");

  const results = await searchCitiesGeoNames(q, 8);

  // فلترة بسيطة + تحويل للشكل الموحد
  return results
    .map(toSuggestion)
    .filter(
      (s) =>
        s.city && s.country && Number.isFinite(s.lat) && Number.isFinite(s.lon),
    );
}
