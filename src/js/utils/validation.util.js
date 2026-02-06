// src/js/utils/validation.util.js

export function requireValue(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }
}

export function requireNumber(value, fieldName) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
}

export function requireLatitude(latitude) {
  requireNumber(latitude, "latitude");
  if (latitude < -90 || latitude > 90) {
    throw new Error("latitude must be between -90 and 90");
  }
}

export function requireLongitude(longitude) {
  requireNumber(longitude, "longitude");
  if (longitude < -180 || longitude > 180) {
    throw new Error("longitude must be between -180 and 180");
  }
}

export function requireMonth(month) {
  requireNumber(month, "month");
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month must be an integer between 1 and 12");
  }
}

export function requireYear(year) {
  requireNumber(year, "year");
  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    throw new Error("year must be a reasonable integer");
  }
}

export function requirePositiveInteger(value, fieldName) {
  requireNumber(value, fieldName);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

export function requireDateDDMMYYYY(dateStr, fieldName = "date") {
  requireValue(dateStr, fieldName);

  // Basic format check: DD-MM-YYYY
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr);
  if (!m) throw new Error(`${fieldName} must be in DD-MM-YYYY format`);

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`${fieldName} day must be between 01 and 31`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`${fieldName} month must be between 01 and 12`);
  }
  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    throw new Error(`${fieldName} year must be a reasonable value`);
  }
}
