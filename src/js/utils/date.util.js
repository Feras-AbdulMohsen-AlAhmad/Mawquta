// Get today's date in ISO format (YYYY-MM-DD)
function getLocalISODate() {
  const date = new Date();
  const today =
    String(date.getDate()).padStart(2, "0") +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    date.getFullYear();
  return today;
}

// Get current year and month as strings
function getCurrentYear() {
  return new Date().getFullYear().toString();
}

// Get current month as a string (1-12)
function getCurrentMonth() {
  return (new Date().getMonth() + 1).toString();
}

export { getCurrentYear, getCurrentMonth, getLocalISODate };
