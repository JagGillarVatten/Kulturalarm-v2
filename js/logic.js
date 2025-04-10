
const MUSIC_SUBJECTS = {
    ENSEMBLE: "Ensemble",
    GEHOR: "Gehör",
    IMPROVISATION: "Improvisation",
    MUSIKPRODUKTION: "Musikproduktion",
    ESTETISK: "Estetisk kommunikation",
    LUNCH: "Lunch",
  }


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
  },
  initializeCustomUrls = () => {
    const savedUrls = getStorageItem("customUrls");
    if (savedUrls) {
      state.customUrls = savedUrls;
      Object.keys(state.customUrls).forEach((e) => {
        const t = document.createElement("option");
        (t.value = `custom_${e}`),
          (t.textContent = e),
          DOM_ELEMENTS.schemaSelect.appendChild(t);
      });
    }
  },
  toggleCustomSchemaManager = () => {
    state.isManagingCustomSchemas = !state.isManagingCustomSchemas;
    updateUIState();
  };

DOM_ELEMENTS.schemaSelect.addEventListener("change", (e) => {
  switchSchedule(e.target.value);
}),
  DOM_ELEMENTS.addCustomUrlBtn.addEventListener("click", addCustomUrl);
DOM_ELEMENTS.removeCustomUrlBtn.addEventListener("click", removeCustomUrl);
DOM_ELEMENTS.manageCustomSchemasBtn.addEventListener("click", toggleCustomSchemaManager);

const savedSchema = localStorage.getItem("lastSelectedSchema") || "mp2";
(DOM_ELEMENTS.schemaSelect.value = savedSchema),
  initializeCustomUrls(),
  switchSchedule(savedSchema),
  setInterval(updateDisplay, CONFIG.REFRESH_INTERVAL),
  setInterval(updateClock, 1e3),
  updateClock();
const cleanupResources = () => {
  state.animationFrameId && cancelAnimationFrame(state.animationFrameId),
    (state.events = []);
};
// Initial UI state
updateUIState();
