import { CONFIG } from "../config.js";
import { getCurrentYear, getCurrentMonth } from "../utils/date.util.js";
import axios from "axios";

// Prayer Times API Calls Functions

// Get prayer timings by city and country
function getTimingsByCity(city, country) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/timingsByCity?city=${city}&country=${country}&method=${CONFIG.METHOD}`,
    )
    .then((response) => {
      //   console.log(response.data.data.timings);
      return response.data.data.timings;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Get prayer timings by latitude and longitude (Coords)
function getTimingsByCoords(latitude, longitude) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/timings?latitude=${latitude}&longitude=${longitude}&method=${CONFIG.METHOD}`,
    )
    .then((response) => {
      //   console.log(response.data.data.timings);
      return response.data.data.timings;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Get prayer timings by address
function getTimingsByAddress(address) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/timingsByAddress?address=${address}&method=${CONFIG.METHOD}`,
    )
    .then((response) => {
      //   console.log(response.data.data.timings);
      return response.data.data.timings;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Get prayer timings by timestamp
function getTimingsByTimestamp(timestamp, latitude, longitude) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/timings?timestamp=${timestamp}&latitude=${latitude}&longitude=${longitude}&method=${CONFIG.METHOD}`,
    )
    .then((response) => {
      console.log(response.data.data.timings);
      //   return response.data.data.timings;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Calendar API Calls Functions

// Get monthly calendar by latitude and longitude (Coords) current year
function getMonthlyCalendarByCoords(latitude, longitude, month) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/calendar?latitude=${latitude}&longitude=${longitude}&method=${CONFIG.METHOD}&month=${month}&year=${getCurrentYear()}`,
    )
    .then((response) => {
      //   console.log(response.data.data);
      return response.data.data;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Get monthly calendar by city and country current month and year
function getMonthlyCalendarByCity(city, country) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/calendarByCity?city=${city}&country=${country}&method=${CONFIG.METHOD}&month=${getCurrentMonth()}&year=${getCurrentYear()}`,
    )
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data.timings;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Get monthly calendar by address current month and year
function getMonthlyCalendarByAddress(address) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/calendarByAddress?address=${address}&method=${CONFIG.METHOD}&method=${CONFIG.METHOD}&month=${getCurrentMonth()}&year=${getCurrentYear()}`,
    )
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch(function (error) {
      console.log(error);
    });
}

// Qibla API Calls Functions


