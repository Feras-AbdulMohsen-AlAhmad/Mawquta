// src/js/utils/qibla.util.js
// Pure, Node-testable Qibla helpers: great-circle initial bearing from a
// location to the Kaaba. No DOM, no axios, no network.

import { requireLatitude, requireLongitude } from "./validation.util.js";
import { CONFIG } from "../config/app.config.js";

export const KAABA_COORDS = Object.freeze({
  latitude: CONFIG.KAABA_COORDS.latitude,
  longitude: CONFIG.KAABA_COORDS.longitude,
});

export function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

// Normalizes any finite bearing to the [0, 360) range.
export function normalizeBearing(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("qibla util: bearing must be a finite number");
  }
  return ((value % 360) + 360) % 360;
}

export const normalize360 = normalizeBearing;

export function shortestSignedAngle(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("qibla util: angle must be a finite number");
  }
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function smoothCircularAngle(previous, current, factor = 0.2) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) {
    throw new Error("qibla util: smoothing angles must be finite");
  }
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
    throw new Error("qibla util: smoothing factor must be in (0, 1]");
  }
  return normalize360(previous + shortestSignedAngle(current - previous) * factor);
}

// Rounds a bearing to the nearest integer degree used for display.
export function roundDegreesForDisplay(bearing) {
  return Math.round(normalizeBearing(bearing));
}

// Formats a bearing as a display string, e.g. "165°".
export function formatDisplayDegrees(bearing) {
  return `${roundDegreesForDisplay(bearing)}°`;
}

// Great-circle initial bearing from (latitude, longitude) to the Kaaba,
// in decimal degrees from North, clockwise, normalized to [0, 360).
export function calculateQiblaBearing(latitude, longitude) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const phi1 = degreesToRadians(latitude);
  const lambda1 = degreesToRadians(longitude);
  const phi2 = degreesToRadians(KAABA_COORDS.latitude);
  const lambda2 = degreesToRadians(KAABA_COORDS.longitude);

  const deltaLambda = lambda2 - lambda1;

  const theta = Math.atan2(
    Math.sin(deltaLambda) * Math.cos(phi2),
    Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda),
  );

  return normalizeBearing(radiansToDegrees(theta));
}
