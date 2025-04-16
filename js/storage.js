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

// Preselect the last selected schema when the page loads
document.addEventListener('DOMContentLoaded', () => {
  if (DOM_ELEMENTS.schemaSelect && state.lastSelectedSchema) {
    DOM_ELEMENTS.schemaSelect.value = state.lastSelectedSchema;
  }
});
const addCustomUrl = () => {
  const e = DOM_ELEMENTS.customUrlInput.value.trim();
  if (!e) return;
  
  const customPromptContainer = document.createElement('div');
  customPromptContainer.classList.add('custom-prompt');
  customPromptContainer.innerHTML = `
      <div class="custom-prompt-content">
          <label for="schemaNameInput">Ange ett namn för detta schema:</label>
          <input type="text" id="schemaNameInput" class="custom-prompt-input">
          <div class="custom-prompt-buttons">
              <button id="confirmSchemaName" class="btn btn-primary">OK</button>
              <button id="cancelSchemaName" class="btn btn-secondary">Avbryt</button>
          </div>
      </div>
  `;
  
  document.body.appendChild(customPromptContainer);
  const schemaNameInput = customPromptContainer.querySelector('#schemaNameInput');
  const confirmButton = customPromptContainer.querySelector('#confirmSchemaName');
  const cancelButton = customPromptContainer.querySelector('#cancelSchemaName');
  
  return new Promise((resolve, reject) => {
      confirmButton.addEventListener('click', () => {
          const t = schemaNameInput.value.trim();
          if (!t) {
              customPromptContainer.remove();
              resolve(null);
              return;
          }
          
          (state.customUrls[t] = e),
          setStorageItem("customUrls", state.customUrls);
          const n = document.createElement("option");
          (n.value = `custom_${t}`),
          (n.textContent = t),
          DOM_ELEMENTS.schemaSelect.appendChild(n),
          (DOM_ELEMENTS.customUrlInput.value = "");
          
          customPromptContainer.remove();
          resolve(t);
      });
      
      cancelButton.addEventListener('click', () => {
          customPromptContainer.remove();
          resolve(null);
      });
      
      schemaNameInput.focus();
  });
},
removeCustomUrl = () => {
  const e = DOM_ELEMENTS.schemaSelect.value;
  if (!e.startsWith("custom_"))
    return void alert("Välj ett anpassat schema att ta bort");
  const t = e.replace("custom_", "");
  confirm(`Är du säker på att du vill ta bort schemat "${t}"?`) &&
    (delete state.customUrls[t],
    setStorageItem("customUrls", state.customUrls),
    DOM_ELEMENTS.schemaSelect.querySelector(`option[value="${e}"]`).remove(),
    (DOM_ELEMENTS.schemaSelect.value = state.lastSelectedSchema),
    switchSchedule(state.lastSelectedSchema));
},
switchSchedule = async (e) => {
  if ((cleanupResources(), e.startsWith("custom_"))) {
    const t = e.replace("custom_", ""),
      n = state.customUrls[t];
    n && (await fetchTimeditSchedule(n));
  } else await loadSchema(e);
  state.lastSelectedSchema = e;
  setStorageItem("lastSelectedSchema", e);
}