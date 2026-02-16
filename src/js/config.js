export const CONFIG = {
  BASE_URL: "https://api.aladhan.com/v1",
  BIG_DATA_CLOUD_API: "https://api.bigdatacloud.net/data",
  METHOD: 2,
  DEFAULT_CITY: "Damascus",
  DEFAULT_COUNTRY: "Syria",
  TZ_FALLBACK: "Asia/Damascus",
  CALENDAR_CACHE_TTL_MS: 6 * 60 * 60 * 1000, // 6 hours

  // Geonames API configuration
  GEONAMES_BASE_URL: "https://secure.geonames.org",
  GEONAMES_USERNAME: "firas_ahmad",

  // Constants & Defaults
  STORAGE_KEY: "ms_location",
  DEFAULT_LOCATION: {
    type: "city",
    city: "Homs",
    country: "Syria",
    // type: "coords",
    // latitude: 34.72682,
    // longitude: 36.72339,
  },
};
