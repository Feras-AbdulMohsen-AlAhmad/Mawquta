// Get the user's current geographic coordinates using the Geolocation API.
// Returns a promise that resolves with an object containing latitude and longitude,
//  or rejects with an error if geolocation is not supported or if there is an issue retrieving the location.

export function getCurrentCoords(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      },
    );
  });
}
