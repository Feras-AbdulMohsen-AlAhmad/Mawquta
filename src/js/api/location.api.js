import {
  requireValue,
  requireNumber,
  requireLatitude,
  requireLongitude,
} from "../utils/validation.util.js";
import { CONFIG } from "../config.js";

// import axios from "axios";

// Axios instance creation for BigDataCloud API
const geoAxios = window.axios.create({
  baseURL: CONFIG.BIG_DATA_CLOUD_API,
  timeout: 10000,
});

// Get current coordinates using Geolocation API
export function getCurrentCoords(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
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
  return { city, country, raw: data };
}
