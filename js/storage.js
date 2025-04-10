CONFIG = {
    REFRESH_INTERVAL: 1e3,
    SHOW_TEACHERS: 10,
    MAX_TEACHERS: 1,
    MAX_GROUPS: 1,
    CACHE_NAME: "schema-cache",
    STORAGE_PREFIX: "schema_app_"
  },
  CACHE_CONFIG = { maxAge: 864e5, version: "1.0" },
  FORMATTERS = {
    date: new Intl.DateTimeFormat("sv-SE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },
  DOM_ELEMENTS = Object.freeze(
    Object.fromEntries(
      [
        "hour",
        "minute",
        "second",
        "dateDisplay",
        "eventName",
        "eventTeacher",
        "eventTime",
        "progressBar",
        "currentEventHeader",
        "scheduleBody",
        "schemaSelect",
        "eventStatus",
        "scheduleError",
        "scheduleErrorText",
        "timeRemaining",
        "digitalClock",
        "customUrlInput",
        "addCustomUrlBtn",
        "removeCustomUrlBtn",
        "manageCustomSchemasBtn",
        "customUrlContainer",
      ].map((e) => [e, document.getElementById(e)])
    )
  );

const getStorageItem = (key) => {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + key));
  } catch {
    return null;
  }
};

const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

let state = {
  events: [],
  animationFrameId: null,
  isLoading: !1,
  hasError: !1,
  errorMessage: "",
  customUrls: getStorageItem("customUrls") || {},
  isManagingCustomSchemas: false,
  lastSelectedSchema: getStorageItem("lastSelectedSchema") || "mp2"
};