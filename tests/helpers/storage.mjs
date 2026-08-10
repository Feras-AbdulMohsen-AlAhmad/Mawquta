import { pathToFileURL } from "node:url";

const SRC = new URL("../../src/js/", import.meta.url).pathname.replace(/^\/+([A-Za-z]):/, "$1:").replaceAll("\\", "/");



export function abs(rel) {
  return pathToFileURL(`${SRC}/${rel}`).href;
}

export class FakeStorage {
  constructor(initial = {}, { getThrows = false, setThrows = false, removeThrows = false } = {}) {
    this.store = new Map(Object.entries(initial));
    this.getThrows = getThrows;
    this.setThrows = setThrows;
    this.removeThrows = removeThrows;
    this.operations = [];
  }

  getItem(key) {
    this.operations.push(`get:${key}`);
    if (this.getThrows) throw new Error("getItem blocked (SecurityError)");
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.operations.push(`set:${key}`);
    if (this.setThrows) throw new Error("setItem blocked (QuotaExceededError)");
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.operations.push(`remove:${key}`);
    if (this.removeThrows) throw new Error("removeItem blocked");
    this.store.delete(key);
  }

  dump() {
    return Object.fromEntries(this.store.entries());
  }
}

export function makeDefaultLocation() {
  return {
    type: "city",
    city: "Damascus",
    country: "Syria",
    latitude: null,
    longitude: null,
    timezone: "Asia/Damascus",
  };
}

export function makeHoms() {
  return {
    type: "city",
    city: "Homs",
    country: "Syria",
    latitude: 34.7308,
    longitude: 36.7094,
    timezone: "Asia/Damascus",
  };
}
