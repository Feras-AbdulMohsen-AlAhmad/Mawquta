import { CONFIG } from "../config.js";

// Create a dedicated axios instance for Geonames API with the base URL and default parameters
const geonamesAxios = window.axios.create({
  baseURL: CONFIG.GEONAMES_BASE_URL,
  timeout: 10000,
  params: { username: CONFIG.GEONAMES_USERNAME },
});

// Function to search for cities using the Geonames API
async function searchCitiesGeoNames({ geonamesQuery, maxRows = 8 }) {
  const res = await geonamesAxios.get("/searchJSON", {
    params: {
      q: geonamesQuery,
      maxRows,
      featureClass: "P", // Populated places (مدن/قرى)
      // optional: lang: "ar",
    },
  });

  return res.data?.geonames || [];
}

export { searchCitiesGeoNames };
