// Set a value in localStorage with an expiry time (TTL)
export function setCache(key, value, ttlMs) {
  const payload = {
    value: value,
    expiryTimestamp: Date.now() + ttlMs, // expiry timestamp
  };

  localStorage.setItem(key, JSON.stringify(payload));
}

// Get a value from localStorage, checking if it's expired
export function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object") return null;

    // expired
    if (
      typeof payload.expiryTimestamp === "number" &&
      Date.now() > payload.expiryTimestamp
    ) {
      localStorage.removeItem(key);
      return null;
    }

    return payload.value ?? null;
  } catch {
    return null;
  }
}
