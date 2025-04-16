
const MUSIC_SUBJECTS = {
    ENSEMBLE: "Ensemble",
    GEHOR: "Gehör",
    IMPROVISATION: "Improvisation",
    MUSIKPRODUKTION: "Musikproduktion",
    ESTETISK: "Estetisk kommunikation",
    LUNCH: "Lunch",
  }



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
