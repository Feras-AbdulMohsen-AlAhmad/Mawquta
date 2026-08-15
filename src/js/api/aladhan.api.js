import { CONFIG } from "../config/app.config.js";
import { createHttpClient } from "./http-client.js";
import {
  requireValue,
  requireLatitude,
  requireLongitude,
  requireMonth,
  requireYear,
} from "../utils/validation.util.js";

// Create an Axios-compatible client. The native-fetch fallback keeps the
// static frontend independent from a third-party CDN at boot.
const axiosInstance = createHttpClient({
  baseURL: CONFIG.BASE_URL,
  timeout: 10000,
  params: { method: CONFIG.METHOD },
});

//========== Prayer Times API Calls Functions =========

// Get prayer timings by city and country
async function getTimingsByCityAndCountry(city, country) {
  requireValue(city, "city");
  requireValue(country, "country");

  const res = await axiosInstance.get(`/timingsByCity`, {
    params: { city, country },
  });
  return res.data.data.timings;
}

// Get prayer timings by latitude and longitude (Coords)
async function getTimingsByCoords(latitude, longitude) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const res = await axiosInstance.get(`/timings`, {
    params: {
      latitude,
      longitude,
    },
  });

  return res.data.data.timings;
}

//========== Calendar API Calls Functions =========

// Get monthly calendar by latitude and longitude (Coords) current year
async function getMonthlyCalendarByCoords(latitude, longitude, month, year) {
  requireLatitude(latitude);
  requireLongitude(longitude);
  requireMonth(month);
  requireYear(year);

  const res = await axiosInstance.get(`/calendar`, {
    params: {
      latitude,
      longitude,
      month,
      year,
    },
  });
  return res.data.data;
}

// Get monthly calendar by city and country
async function getMonthlyCalendarByCity(city, country, month, year) {
  requireValue(city, "city");
  requireValue(country, "country");
  requireMonth(month);
  requireYear(year);

  const res = await axiosInstance.get(`/calendarByCity`, {
    params: {
      city,
      country,
      month,
      year,
    },
  });
  return res.data.data;
}

export {
  getTimingsByCityAndCountry,
  getTimingsByCoords,
  getMonthlyCalendarByCoords,
  getMonthlyCalendarByCity,
};
