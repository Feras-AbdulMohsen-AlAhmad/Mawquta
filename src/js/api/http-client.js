/**
 * Small browser HTTP adapter used by the active API modules.
 *
 * Axios remains supported when an embedding application provides window.axios,
 * but the shipped static frontend must also work without a CDN dependency.
 */
export function createHttpClient({ baseURL, timeout = 10000, params = {} }) {
  const axios = globalThis.window?.axios;
  if (typeof axios?.create === "function") {
    return axios.create({ baseURL, timeout, params });
  }

  return Object.freeze({
    async get(path, options = {}) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries({
        ...params,
        ...(options.params || {}),
      })) {
        if (value !== undefined && value !== null) {
          query.set(key, String(value));
        }
      }

      const normalizedBaseURL = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
      const url = new URL(String(path).replace(/^\/+/, ""), normalizedBaseURL);
      url.search = query.toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const error = new Error(`HTTP request failed: ${response.status}`);
        error.response = { status: response.status };
        throw error;
      }

      return {
        data: await response.json(),
        status: response.status,
        headers: response.headers,
      };
    },
  });
}
