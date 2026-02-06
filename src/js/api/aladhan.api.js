import { CONFIG } from "../config.js";
// import {} from "../utils/validation.util.js";
import {
  requireValue,
  requireLatitude,
  requireLongitude,
  requireMonth,
  requireYear,
  requirePositiveInteger,
  requireDateDDMMYYYY,
} from "../utils/validation.util.js";

import axios from "axios";

// Axios instance creation
const axiosInstance = axios.create({
  baseURL: CONFIG.BASE_URL,
  timeout: 10000,
  params: { method: CONFIG.METHOD },
  // headers: { "X-Custom-Header": "foobar" },
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

// Get prayer timings by address
async function getTimingsByAddress(address) {
  requireValue(address, "address");

  const res = await axiosInstance.get(`/timingsByAddress`, {
    params: {
      address,
    },
  });
  return res.data.data.timings;
}

// Get prayer timings by timestamp
async function getTimingsByTimestamp(timestamp, latitude, longitude) {
  requirePositiveInteger(timestamp, "timestamp");
  requireLatitude(latitude);
  requireLongitude(longitude);

  const res = await axiosInstance.get(`/timings`, {
    params: {
      timestamp,
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

// Get monthly calendar by address
async function getMonthlyCalendarByAddress(address, month, year) {
  requireValue(address, "address");
  requireMonth(month);
  requireYear(year);

  const res = await axiosInstance.get(`/calendarByAddress`, {
    params: {
      address,
      month,
      year,
    },
  });
  return res.data.data;
}

//========== Qibla API Calls Functions ==========

// Get qibla direction by latitude and longitude (Coords)
async function getQiblaDirectionByCoords(latitude, longitude) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const res = await axiosInstance.get(`/qibla/${latitude}/${longitude}`);
  return res.data.data;
}

// Get qibla direction by latitude and longitude (Coords) in compass format
async function getQiblaCompassBlobByCoords(latitude, longitude) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const res = await axiosInstance.get(
    `/qibla/${latitude}/${longitude}/compass`,
    { responseType: "blob" },
  );
  return res.data;
  // to use the blob must create URL using URL.createObjectURL(blob)
}

//========== AsmaAlHusna API Calls Functions ==========

// Get all Asma Al-Husna
async function getAllAsmaAlHusna() {
  const res = await axiosInstance.get(`/asmaAlHusna`);
  return res.data.data;
}

// Get Asma Al-Husna by index-
async function getAsmaAlHusnaByIndex(index) {
  requirePositiveInteger(index, "index");
  const res = await axiosInstance.get(`/asmaAlHusna/${index}`);
  return res.data.data;
}

//========== Hijri Calendar API Calls Functions =========

// Get Hijri calendar for a given Gregorian month and year
async function getHijriCalendarForGregorianMonth(month, year) {
  requireMonth(month);
  requireYear(year);

  const res = await axiosInstance.get(`/gToHCalendar`, {
    params: {
      month,
      year,
    },
  });
  return res.data.data;
}

// Get Gregorian calendar for a given Hijri month and year
async function getGregorianCalendarForHijriMonth(month, year) {
  requireMonth(month);
  requireYear(year);

  const res = await axiosInstance.get(`/hToGCalendar`, {
    params: {
      month,
      year,
    },
  });
  return res.data.data;
}

// Get Hijri date for a given Gregorian date (Format: DD-MM-YYYY) as String
async function convertGregorianDateToHijriDate(fullDate) {
  requireDateDDMMYYYY(fullDate, "Gregorian date");
  const res = await axiosInstance.get(`/gToH`, {
    params: {
      date: fullDate,
    },
  });
  return res.data.data;
}

// Get Gregorian date for a given Hijri date (Format: DD-MM-YYYY) as String
async function convertHijriDateToGregorianDate(fullDate) {
  requireDateDDMMYYYY(fullDate, "Hijri date");
  const res = await axiosInstance.get(`/hToG`, {
    params: {
      date: fullDate,
    },
  });
  return res.data.data;
}

export {
  getTimingsByCityAndCountry,
  getTimingsByCoords,
  getTimingsByAddress,
  getTimingsByTimestamp,
  getMonthlyCalendarByCoords,
  getMonthlyCalendarByCity,
  getMonthlyCalendarByAddress,
  getQiblaDirectionByCoords,
  getQiblaCompassBlobByCoords,
  getAllAsmaAlHusna,
  getAsmaAlHusnaByIndex,
  getHijriCalendarForGregorianMonth,
  getGregorianCalendarForHijriMonth,
  convertGregorianDateToHijriDate,
  convertHijriDateToGregorianDate,
};
