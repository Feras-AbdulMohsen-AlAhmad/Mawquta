import { CONFIG } from "../config.js";
import axios from "axios";

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
