const MUSIC_SUBJECTS = {
    ENSEMBLE: "Ensemble",
    GEHOR: "Gehör",
    IMPROVISATION: "Improvisation",
    MUSIKPRODUKTION: "Musikproduktion",
    ESTETISK: "Estetisk kommunikation",
    LUNCH: "Lunch",
  },
  CONFIG = {
    REFRESH_INTERVAL: 1e3,
    SHOW_TEACHERS: !0,
    MAX_TEACHERS: 1,
    MAX_GROUPS: 1,
    CACHE_NAME: "schema-cache",
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
let state = {
  events: [],
  animationFrameId: null,
  isLoading: !1,
  hasError: !1,
  errorMessage: "",
  customUrls: JSON.parse(localStorage.getItem("customUrls") || "{}"),
  isManagingCustomSchemas: false,
};
const debounce = (e, t) => {
    let n;
    return (...r) => {
      clearTimeout(n), (n = setTimeout(() => e(...r), t));
    };
  },
  formatTimeRemaining = (e) =>
    e < 6e4
      ? `${Math.floor(e / 1e3)}s`
      : ((t = Math.floor(e / 6e4)),
        (n = Math.floor(t / 60)),
        n > 0 ? `${n}t ${t % 60}m` : `${t}m`);
var t, n;
const updateClock = () => {
    const e = new Date(),
      t = e.getSeconds(),
      n = e.getMinutes(),
      r = e.getHours() % 12;
    (DOM_ELEMENTS.hour.style.transform = `rotate(${30 * r + n / 2}deg)`),
      (DOM_ELEMENTS.minute.style.transform = `rotate(${6 * n}deg)`),
      (DOM_ELEMENTS.second.style.transform = `rotate(${6 * t}deg)`),
      (DOM_ELEMENTS.digitalClock.textContent = `${e
        .getHours()
        .toString()
        .padStart(2, "0")}:${n.toString().padStart(2, "0")}`);
  },
  parseEventInfo = (e, t = "") => {
    try {
      const n = e.split(",").map((e) => e.trim()),
        r = n[0],
        s = n.find((e) => !e.match(/AML|MP|LA/)) || "",
        a = /(?:AM|LA|MP)\d+[a-d]?/g,
        o = e.match(a) || [],
        i = t.match(a) || [],
        c = [...new Set([...o, ...i])].map((e) => {
          const t = e.match(/\d+/),
            n = e.match(/[a-d]$/),
            r = t ? t[0] : "",
            s = n ? n[0].toLowerCase() : "",
            a = [];
          
          if (e.includes("AML")) {
            a.push(`AM${r}`);
            a.push(`LA${r}`);
            a.push(`MP${r}`);
          } else {
            if (e.includes("AM")) a.push(`AM${r}`);
            if (e.includes("LA")) a.push(`LA${r}`);
            if (e.includes("MP")) a.push(`MP${r}`);
          }

          return s ? `${a.join(" ")} ${s}` : a.join(" ");
        });
      return {
        courseName: r || "Okänd aktivitet",
        teacher: s,
        groups: c,
        rawDescription: t,
      };
    } catch (n) {
      return (
        console.error("Error parsing event info:", n),
        {
          courseName: e || "Okänd aktivitet",
          teacher: "",
          groups: [],
          rawDescription: t,
        }
      );
    }
  },
  processEvents = (e) =>
    new ICAL.Component(ICAL.parse(e))
      .getAllSubcomponents("vevent")
      .map((e) => {
        const t = new ICAL.Event(e),
          n = e.getFirstPropertyValue("description") || "";
        return {
          ...parseEventInfo(t.summary, n),
          startDate: t.startDate.toJSDate(),
          endDate: t.endDate.toJSDate(),
        };
      })
      .reduce((e, t) => {
        const n = e.find(
          (e) =>
            (t.startDate >= e.startDate && t.startDate <= e.endDate) ||
            (t.endDate >= e.startDate && t.endDate <= e.endDate)
        );
        return n
          ? (n.courseName === t.courseName
              ? ((n.teacher = [n.teacher, t.teacher]
                  .filter(Boolean)
                  .join(", ")),
                (n.groups = [...new Set([...n.groups, ...t.groups])]))
              : ((n.courseName += ` / ${t.courseName}`),
                (n.teacher = [n.teacher, t.teacher].filter(Boolean).join(", ")),
                (n.groups = [...new Set([...n.groups, ...t.groups])])),
            e)
          : [...e, t];
      }, [])
      .sort((e, t) => e.startDate - t.startDate),
  updateUIState = () => {
    document
      .querySelectorAll(".schedule-table, .current-event")
      .forEach((e) => {
        e.classList.toggle("loading", state.isLoading);
      }),
      (DOM_ELEMENTS.scheduleError.style.display = state.hasError
        ? "flex"
        : "none"),
      state.hasError &&
        (DOM_ELEMENTS.scheduleErrorText.textContent = state.errorMessage);
    
    DOM_ELEMENTS.customUrlContainer.style.display = state.isManagingCustomSchemas ? "block" : "none";
  },
  updateDisplay = (() => {
    let e = 0;
    const t = () => {
      const n = new Date();
      if (!(n - e < CONFIG.REFRESH_INTERVAL)) {
        (e = n),
          (DOM_ELEMENTS.dateDisplay.textContent = FORMATTERS.date.format(n));
        const r = state.events.find((e) => n >= e.startDate && n <= e.endDate),
          s = state.events.find((e) => n < e.startDate);
        if (
          (r && r.courseName.toLowerCase() !== "lunch"
            ? ((DOM_ELEMENTS.eventStatus.textContent = "● Pågår nu"),
              (DOM_ELEMENTS.eventStatus.className =
                "event-status status-ongoing"),
              (DOM_ELEMENTS.eventName.textContent = r.courseName),
              (DOM_ELEMENTS.eventTeacher.textContent = CONFIG.SHOW_TEACHERS
                ? r.teacher
                : ""),
              (DOM_ELEMENTS.eventTime.textContent = `Slutar ${FORMATTERS.time.format(
                r.endDate
              )}`),
              (DOM_ELEMENTS.timeRemaining.textContent = formatTimeRemaining(
                r.endDate - n
              )))
            : s
            ? ((DOM_ELEMENTS.eventStatus.textContent = "○ Kommande"),
              (DOM_ELEMENTS.eventStatus.className =
                "event-status status-upcoming"),
              (DOM_ELEMENTS.eventName.textContent = s.courseName),
              (DOM_ELEMENTS.eventTeacher.textContent = CONFIG.SHOW_TEACHERS
                ? s.teacher
                : ""),
              (DOM_ELEMENTS.eventTime.textContent = `Börjar ${FORMATTERS.time.format(
                s.startDate
              )}`),
              (DOM_ELEMENTS.timeRemaining.textContent = formatTimeRemaining(
                s.startDate - n
              )))
            : ((DOM_ELEMENTS.eventStatus.textContent =
                "Inga fler aktiviteter idag"),
              (DOM_ELEMENTS.eventStatus.className = "event-status"),
              (DOM_ELEMENTS.eventName.textContent =
                "Inga fler aktiviteter idag"),
              (DOM_ELEMENTS.eventTeacher.textContent = ""),
              (DOM_ELEMENTS.eventTime.textContent = ""),
              (DOM_ELEMENTS.timeRemaining.textContent = "")),
          r && r.courseName.toLowerCase() !== "lunch")
        ) {
          const e = r.endDate - r.startDate,
            t = ((n - r.startDate) / e) * 100;
          DOM_ELEMENTS.progressBar.style.width = `${t}%`;
        } else DOM_ELEMENTS.progressBar.style.width = "0";
      }
    };
    return (
      requestAnimationFrame(function e() {
        t(), (state.animationFrameId = requestAnimationFrame(e));
      }),
      t
    );
  })(),
  updateScheduleTable = () => {
    if (!DOM_ELEMENTS.scheduleBody) return;
    const e = new Date(),
      t = new Date(e);
    t.setHours(0, 0, 0, 0);
    const n = new Date(e);
    n.setHours(23, 59, 59, 999),
      (DOM_ELEMENTS.scheduleBody.innerHTML = state.events
        .filter(
          (e) =>
            (e.startDate >= t && e.startDate <= n) ||
            (e.endDate >= t && e.endDate <= n) ||
            (e.startDate <= t && e.endDate >= n)
        )
        .map((t) => {
          const n = FORMATTERS.time.format(t.startDate),
            r = FORMATTERS.time.format(t.endDate);
          return `<tr class="${
            e >= t.startDate && e <= t.endDate ? "current" : ""
          }"><td>${n} - ${r}</td><td>${
            t.courseName
          }</td><td>${formatTimeRemaining(
            t.endDate - t.startDate
          )}</td><td>${t.groups
            .slice(0, CONFIG.MAX_GROUPS)
            .join(", ")}</td></tr>`;
        })
        .join(""));
  },
  toggleSchedule = () => {
    document.querySelector(".schedule-table").classList.toggle("visible");
  };
async function fetchTimeditSchedule(e) {
  try {
    (state.isLoading = !0), updateUIState();
    const t = await fetch(e);
    if (!t.ok) throw new Error("Failed to fetch schedule from Timedit");
    const n = await t.text();
    localStorage.setItem("current_schedule", n),
      localStorage.setItem("last_schedule_fetch", Date.now().toString()),
      (state.events = processEvents(n)),
      (state.isLoading = !1),
      (state.hasError = !1),
      updateUIState(),
      updateDisplay(),
      updateScheduleTable();
  } catch (t) {
    console.error("Error fetching Timedit schedule:", t),
      (state.isLoading = !1),
      (state.hasError = !0),
      (state.errorMessage =
        "Failed to fetch schedule. Please try again later."),
      updateUIState();
  }
}
const addCustomUrl = () => {
    const e = DOM_ELEMENTS.customUrlInput.value.trim();
    if (!e) return;
    const t = prompt("Enter a name for this schedule:");
    if (!t) return;
    (state.customUrls[t] = e),
      localStorage.setItem("customUrls", JSON.stringify(state.customUrls));
    const n = document.createElement("option");
    (n.value = `custom_${t}`),
      (n.textContent = t),
      DOM_ELEMENTS.schemaSelect.appendChild(n),
      (DOM_ELEMENTS.customUrlInput.value = "");
  },
  removeCustomUrl = () => {
    const e = DOM_ELEMENTS.schemaSelect.value;
    if (!e.startsWith("custom_"))
      return void alert("Please select a custom schedule to remove");
    const t = e.replace("custom_", "");
    confirm(`Are you sure you want to remove the schedule "${t}"?`) &&
      (delete state.customUrls[t],
      localStorage.setItem("customUrls", JSON.stringify(state.customUrls)),
      DOM_ELEMENTS.schemaSelect.querySelector(`option[value="${e}"]`).remove(),
      (DOM_ELEMENTS.schemaSelect.value = "mp1"),
      switchSchedule("mp1"));
  },
  switchSchedule = async (e) => {
    if ((cleanupResources(), e.startsWith("custom_"))) {
      const t = e.replace("custom_", ""),
        n = state.customUrls[t];
      n && (await fetchTimeditSchedule(n));
    } else await loadSchema(e);
    localStorage.setItem("lastSelectedSchema", e);
  },
  initializeCustomUrls = () => {
    Object.keys(state.customUrls).forEach((e) => {
      const t = document.createElement("option");
      (t.value = `custom_${e}`),
        (t.textContent = e),
        DOM_ELEMENTS.schemaSelect.appendChild(t);
    });
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