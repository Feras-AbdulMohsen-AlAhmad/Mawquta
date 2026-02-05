/**
 * Application State Management
 * Centralized state store with observer pattern
 */

const AppState = (() => {
  let state = {
    location: {
      latitude: CONFIG.DEFAULT_LOCATION.latitude,
      longitude: CONFIG.DEFAULT_LOCATION.longitude,
      name: CONFIG.DEFAULT_LOCATION.name,
      timezone: null,
    },
    prayerTimes: null,
    calendar: null,
    qibla: null,
    asmaAlHusna: null,
    theme: CONFIG.DEFAULT_THEME,
    method: CONFIG.API.DEFAULT_METHOD,
    currentDate: DateUtil.getCurrentDate(),
    selectedMonth: DateUtil.getCurrentMonthYear().month,
    selectedYear: DateUtil.getCurrentMonthYear().year,
  };

  // Observers
  const observers = {
    location: [],
    prayerTimes: [],
    calendar: [],
    qibla: [],
    theme: [],
    method: [],
  };

  /**
   * Subscribe to state changes
   * @param {string} property
   * @param {function} callback
   */
  const subscribe = (property, callback) => {
    if (observers[property]) {
      observers[property].push(callback);
    }
  };

  /**
   * Notify all observers of a property change
   * @param {string} property
   * @param {any} newValue
   */
  const notify = (property, newValue) => {
    if (observers[property]) {
      observers[property].forEach((callback) => callback(newValue));
    }
  };

  /**
   * Get state value
   * @param {string} property
   * @returns {any}
   */
  const get = (property) => {
    return state[property];
  };

  /**
   * Set state value
   * @param {string} property
   * @param {any} value
   */
  const set = (property, value) => {
    if (state.hasOwnProperty(property)) {
      state[property] = value;
      notify(property, value);
      saveToStorage();
    }
  };

  /**
   * Get entire state
   * @returns {object}
   */
  const getAll = () => {
    return { ...state };
  };

  /**
   * Load state from localStorage
   */
  const loadFromStorage = () => {
    try {
      // Load location
      const savedLocation = localStorage.getItem(CONFIG.STORAGE.LOCATION);
      if (savedLocation) {
        state.location = JSON.parse(savedLocation);
      }

      // Load theme
      const savedTheme = localStorage.getItem(CONFIG.STORAGE.THEME);
      if (savedTheme) {
        state.theme = savedTheme;
      }

      // Load method
      const savedMethod = localStorage.getItem(CONFIG.STORAGE.METHOD);
      if (savedMethod) {
        state.method = parseInt(savedMethod, 10);
      }
    } catch (error) {
      console.error("Error loading state from storage:", error);
    }
  };

  /**
   * Save state to localStorage
   */
  const saveToStorage = () => {
    try {
      localStorage.setItem(
        CONFIG.STORAGE.LOCATION,
        JSON.stringify(state.location),
      );
      localStorage.setItem(CONFIG.STORAGE.THEME, state.theme);
      localStorage.setItem(CONFIG.STORAGE.METHOD, state.method.toString());
    } catch (error) {
      console.error("Error saving state to storage:", error);
    }
  };

  /**
   * Reset state to defaults
   */
  const reset = () => {
    state = {
      location: CONFIG.DEFAULT_LOCATION,
      prayerTimes: null,
      calendar: null,
      qibla: null,
      asmaAlHusna: null,
      theme: CONFIG.DEFAULT_THEME,
      method: CONFIG.API.DEFAULT_METHOD,
      currentDate: DateUtil.getCurrentDate(),
      selectedMonth: DateUtil.getCurrentMonthYear().month,
      selectedYear: DateUtil.getCurrentMonthYear().year,
    };
    localStorage.clear();
  };

  // Initialize by loading from storage
  loadFromStorage();

  return {
    subscribe,
    notify,
    get,
    set,
    getAll,
    loadFromStorage,
    saveToStorage,
    reset,
  };
})();
