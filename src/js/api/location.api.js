import {
  requireValue,
  requireNumber,
  requireLatitude,
  requireLongitude,
} from "../utils/validation.util.js";
import { CONFIG } from "../config/app.config.js";
import { createHttpClient } from "./http-client.js";

// Axios is supported when supplied by the host; native fetch is the default.
const geoAxios = createHttpClient({
  baseURL: CONFIG.BIG_DATA_CLOUD_API,
  timeout: 10000,
});

function resolveTimezone(data) {
  const directTimezone =
    data?.timezone || data?.timeZone || data?.timezoneId || data?.timeZoneId;

  if (typeof directTimezone === "string" && directTimezone.trim()) {
    return directTimezone.trim();
  }

  const informative = Array.isArray(data?.localityInfo?.informative)
    ? data.localityInfo.informative
    : [];
  const timezoneEntry = informative.find((item) => {
    const description = String(item?.description || "").toLowerCase();
    return (
      description.includes("time zone") ||
      description.includes("timezone") ||
      description.includes("منطقة زمنية")
    );
  });

  return String(timezoneEntry?.name || timezoneEntry?.isoName || "").trim();
}

// Get current coordinates using Geolocation API
export function getCurrentCoords(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const latitude = position?.coords?.latitude;
          const longitude = position?.coords?.longitude;
          requireNumber(latitude, "latitude");
          requireNumber(longitude, "longitude");
          requireLatitude(latitude);
          requireLongitude(longitude);
          resolve({ latitude, longitude });
        } catch (error) {
          reject(error);
        }
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      },
    );
  });
}

// Get city and country from latitude and longitude using BigDataCloud reverse geocoding API
export async function reverseGeocodeToCityCountry(
  latitude,
  longitude,
  localityLanguage,
) {
  requireNumber(latitude, "latitude");
  requireNumber(longitude, "longitude");
  requireValue(latitude, "latitude");
  requireValue(longitude, "longitude");
  requireLatitude(latitude);
  requireLongitude(longitude);

  const res = await geoAxios.get("/reverse-geocode-client", {
    params: {
      latitude,
      longitude,
      localityLanguage,
    },
  });

  const data = res.data;

  const city = data.city || data.locality || data.principalSubdivision || "";

  const country = data.countryName || "";
  const timezone = resolveTimezone(data);

  return { city, country, timezone };
}



