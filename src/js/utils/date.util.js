function getCurrentYear() {
  return new Date().getFullYear().toString();
}

function getCurrentMonth() {
  return (new Date().getMonth() + 1).toString();
}

export { getCurrentYear, getCurrentMonth };
