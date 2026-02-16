import { CONFIG } from "../config.js";

const geoAxios = window.axios.create({
  baseURL: "https://secure.geonames.org",
  timeout: 10000,
});

export async function searchCitySuggestions(query, options = {}) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];

  const { maxRows = 8, lang = "en" } = options;

  const res = await geoAxios.get("/searchJSON", {
    params: {
      name_startsWith: q, // أهم شيء: البحث حسب ما كتبت
      featureClass: "P", // أماكن سكن/مدن
      maxRows,
      username: CONFIG.GEONAMES_USERNAME,
      style: "FULL",
      lang,
    },
  });

  const items = Array.isArray(res?.data?.geonames) ? res.data.geonames : [];

  return items.map((x) => ({
    label: `${x.name}, ${x.countryName}`,
    city: x.name,
    country: x.countryName,
    lat: Number(x.lat),
    lon: Number(x.lng),
  }));
}
