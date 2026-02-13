import { getQiblaDirectionByCoords } from "../api/aladhan.api.js";
import { requireLatitude, requireLongitude } from "../utils/validation.util.js";

// Get qibla direction and coordinates by user's latitude and longitude
export async function getQiblaByCoords(latitude, longitude) {
  requireLatitude(latitude);
  requireLongitude(longitude);

  const data = await getQiblaDirectionByCoords(latitude, longitude);

  const direction = Number(data?.direction);

  if (!Number.isFinite(direction)) {
    throw new Error("Invalid qibla direction returned from API");
  }

  return {
    direction, // degrees from North (clockwise)
    latitude: data.latitude,
    longitude: data.longitude,
  };
}
