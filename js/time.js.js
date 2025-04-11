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
        r = n[0].replace(/(?:AML|LA|MP)\d+[a-d]?/gi, '').trim(),
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
          courseName: e.replace(/(?:AM|LA|MP)\d+[a-d]?/gi, '').trim() || "Okänd aktivitet",
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
    
    DOM_ELEMENTS.customUrlContainer.style.display = state.isManagingCustomSchemas ? "flex" : "none";
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
    if (!t.ok) throw new Error("Kunde inte hämta schema från Timedit");
    const n = await t.text();
    setStorageItem("current_schedule", n);
    setStorageItem("last_schedule_fetch", Date.now());
    (state.events = processEvents(n)),
      (state.isLoading = !1),
      (state.hasError = !1),
      updateUIState(),
      updateDisplay(),
      updateScheduleTable();
  } catch (t) {
    console.error("Fel vid hämtning av Timedit-schema:", t),
      (state.isLoading = !1),
      (state.hasError = !0),
      (state.errorMessage =
        "Kunde inte hämta schema. Försök igen senare."),
      updateUIState();
  }
}

// Add this function to initialize the schedule at startup
async function initializeSchedule() {
  const storedSchedule = getStorageItem("current_schedule");
  const lastFetchTime = getStorageItem("last_schedule_fetch");
  const currentTime = Date.now();

  // Check if stored schedule exists and is not too old (e.g., less than 24 hours)
  if (storedSchedule && lastFetchTime && (currentTime - lastFetchTime) < 24 * 60 * 60 * 1000) {
    state.events = processEvents(storedSchedule);
    updateDisplay();
    updateScheduleTable();
  } else {
    // If no stored schedule or schedule is old, fetch a new one
    await fetchTimeditSchedule(CONFIG.SCHEDULE_URL);
  }
}

// Call initializeSchedule when the application starts
document.addEventListener('DOMContentLoaded', initializeSchedule);