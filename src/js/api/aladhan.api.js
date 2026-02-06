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
    .catch((error) => {
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
    .catch((error) => {
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
    .catch((error) => {
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
    .catch((error) => {
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
    .catch((error) => {
      console.log(error);
    });
}

// Get monthly calendar by city and country
function getMonthlyCalendarByCity(city, country, month, year) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/calendarByCity?city=${city}&country=${country}&method=${CONFIG.METHOD}&month=${month}&year=${year}`,
    )
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data.timings;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Get monthly calendar by address
function getMonthlyCalendarByAddress(address, month, year) {
  axios
    .get(
      CONFIG.BASE_URL +
        `/calendarByAddress?address=${address}&method=${CONFIG.METHOD}&method=${CONFIG.METHOD}&month=${month}&year=${year}`,
    )
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Qibla API Calls Functions

// Get qibla direction by latitude and longitude (Coords)
function getQiblaDirectionByCoords(latitude, longitude) {
  axios
    .get(CONFIG.BASE_URL + `/qibla/${latitude}/${longitude}`)
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Get qibla direction by latitude and longitude (Coords) in compass format
function getQiblaDirectionByCoordsCompass(latitude, longitude) {
  {
    axios
      .get(CONFIG.BASE_URL + `/qibla/${latitude}/${longitude}/compass`)
      .then((response) => {
        console.log(response.data);
        //   return response.data.data;
      })
      .catch((error) => {
        console.log(error);
      });
  }
}

// AsmaAlHusna API Calls Functions

// Get all Asma Al-Husna
function getAllAsmaAlHusna() {
  axios
    .get(CONFIG.BASE_URL + `/asmaAlHusna`)
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Get Asma Al-Husna by index-
function getAsmaAlHusnaByIndex(index) {
  {
    axios
      .get(CONFIG.BASE_URL + `/asmaAlHusna/${index}`)
      .then((response) => {
        console.log(response.data.data);
        //   return response.data.data;
      })
      .catch((error) => {
        console.log(error);
      });
  }
}

// Hijri Calendar API Calls Functions

// Get Hijri calendar for a given Gregorian month and year
function getHijriCalendarForGregorianMonth(month, year) {
  axios
    .get(CONFIG.BASE_URL + `/gToHCalendar/${month}/${year}`)
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Get Gregorian calendar for a given Hijri month and year
function getGregorianCalendarForHijriMonth(month, year) {
  axios
    .get(CONFIG.BASE_URL + `/hToGCalendar/${month}/${year}`)
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Get Hijri date for a given Gregorian date (Format: DD-MM-YYYY) as String
function convertGregorianDateToHijriDate(fullDate) {
  axios
    .get(CONFIG.BASE_URL + `/gToH/${fullDate}`)
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

// Get Gregorian date for a given Hijri date (Format: DD-MM-YYYY) as String
function convertHijriDateToGregorianDate(fullDate) {
  axios
    .get(CONFIG.BASE_URL + `/gToH/${fullDate}`)
    .then((response) => {
      console.log(response.data.data);
      //   return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}
