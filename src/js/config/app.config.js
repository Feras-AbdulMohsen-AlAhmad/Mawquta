export const CONFIG = {
  BASE_URL: "https://api.aladhan.com/v1",
  BIG_DATA_CLOUD_API: "https://api.bigdatacloud.net/data",
  METHOD: 2,
  LOCALE: "ar-SY",
  TZ_FALLBACK: "Asia/Damascus",
  CALENDAR_CACHE_TTL_MS: 6 * 60 * 60 * 1000, // 6 hours

  // Qibla calculation constants
  KAABA_COORDS: {
    latitude: 21.4225241,
    longitude: 39.8261818,
  },

  // Curated coordinates for the default (coordinate-less) Damascus location
  // so Qibla computes a local bearing without any geocode request.
  DEFAULT_LOCATION_COORDS: {
    latitude: 33.5138,
    longitude: 36.2765,
  },

  // Constants & Defaults
  STORAGE_KEY: "ms_location",
  DEFAULT_LOCATION: {
    type: "city",
    city: "Damascus",
    country: "Syria",
    latitude: null,
    longitude: null,
    timezone: "Asia/Damascus",
  },
};
