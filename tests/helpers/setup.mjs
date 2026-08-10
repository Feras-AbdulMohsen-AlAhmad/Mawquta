// Node globals used by browser-oriented production modules imported in tests.
globalThis.window ??= {};
globalThis.window.axios ??= { create: () => ({ get: async () => ({ data: {} }) }) };
globalThis.window.location ??= { origin: "http://localhost" };
globalThis.bootstrap ??= { Modal: { getOrCreateInstance: () => ({ hide() {} }) } };
globalThis.navigator ??= {};
