// Constants and Configuration
const MUSIC_SUBJECTS = Object.freeze({
  ENSEMBLE: "Ensemble",
  GEHOR: "Gehör",
  IMPROVISATION: "Improvisation",
  MUSIKPRODUKTION: "Musikproduktion",
  ESTETISK: "Estetisk kommunikation",
  LUNCH: "Lunch",
});

const CONFIG = Object.freeze({
  REFRESH_INTERVAL: 1000,
  SHOW_TEACHERS: false,
  MAX_TEACHERS: 2,
  MAX_GROUPS: 4,
  CACHE_NAME: "schema-cache",
  TIMEDIT_URL:
    "https://cloud.timeedit.net/medborgarskolan/web/elev/ri609QZZ1Q2ZeQQ55888d8B4y0Z4Z8t87u1YZ6QQ564t6n9bBA8Q41BBBCF74433CD00A00DCD3B.ics",
  AUTO_FETCH_INTERVAL: 3600000, // 1 hour in milliseconds
});

const FORMATTERS = Object.freeze({
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
});

const DOM_ELEMENTS = Object.freeze(
  Object.fromEntries(
    [
      "hourHand",
      "minuteHand",
      "secondHand",
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
    ].map((id) => [id, document.getElementById(id)])
  )
);

// State management
let state = {
  events: [],
  animationFrameId: null,
  isLoading: false,
  hasError: false,
  errorMessage: "",
};

// Utility Functions
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const formatTimeRemaining = (ms) => {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000),
    hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}t ${minutes % 60}m` : `${minutes}m`;
};

// UI Effects
const apply3DTransform = (element, depth = 20) => {
  if (!element) return;

  const rect = element.getBoundingClientRect(),
    centerX = rect.left + rect.width / 2,
    centerY = rect.top + rect.height / 2,
    mouseX = event.clientX - centerX,
    mouseY = event.clientY - centerY,
    rotateX = (mouseY / centerY) * depth,
    rotateY = -(mouseX / centerX) * depth;

  element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
};

window.addEventListener("mousemove", (event) => {
  requestAnimationFrame(() => {
    document.querySelectorAll(".depth-effect").forEach((element) => {
      apply3DTransform(element);
    });
  });
});

// Clock Functions
const updateClock = () => {
  const now = new Date(),
    hours = now.getHours() % 12,
    minutes = now.getMinutes(),
    seconds = now.getSeconds(),
    hourDeg = 30 * (hours + minutes / 60),
    minuteDeg = 6 * minutes,
    secondDeg = 6 * seconds;

  requestAnimationFrame(() => {
    DOM_ELEMENTS.hourHand.style.transform = `perspective(1000px) rotateZ(${hourDeg}deg) translateZ(20px)`;
    DOM_ELEMENTS.minuteHand.style.transform = `perspective(1000px) rotateZ(${minuteDeg}deg) translateZ(40px)`;
    DOM_ELEMENTS.secondHand.style.transform = `perspective(1000px) rotateZ(${secondDeg}deg) translateZ(60px)`;
  });
};

// Event Processing Functions
const parseEventInfo = (summary, description = "") => {
  try {
    const parts = summary.split(",").map((part) => part.trim());
    const courseName = parts[0];
    const teacher = parts.find((part) => !part.match(/AML|MP|LA/)) || "";

    const groupRegex = /(AM|LA|MP)\d+[a-d]?/g;
    const summaryGroups = summary.match(groupRegex) || [];
    const descriptionGroups = description.match(groupRegex) || [];
    const groups = [...new Set([...summaryGroups, ...descriptionGroups])];

    const parsedGroups = groups.map((group) => {
      const yearMatch = group.match(/\d+/);
      const sectionMatch = group.match(/[a-d]$/);
      const year = yearMatch ? yearMatch[0] : "";
      const section = sectionMatch ? sectionMatch[0].toLowerCase() : "";

      const programs = [];
      const groupText = group.toUpperCase();

      if (groupText.includes("AM")) programs.push(`AM${year}`);
      if (groupText.includes("LA")) programs.push(`LA${year}`);
      if (groupText.includes("MP")) programs.push(`MP${year}`);

      const combinedPrograms = programs.join(" ");
      return section ? `${combinedPrograms} ${section}` : combinedPrograms;
    });

    return {
      courseName: courseName || "Okänd aktivitet",
      teacher: teacher,
      groups: parsedGroups,
      rawDescription: description,
    };
  } catch (error) {
    console.error("Error parsing event info:", error);
    return {
      courseName: summary || "Okänd aktivitet",
      teacher: "",
      groups: [],
      rawDescription: description,
    };
  }
};

const processEvents = (data) => {
  return new ICAL.Component(ICAL.parse(data))
    .getAllSubcomponents("vevent")
    .map((event) => {
      const icalEvent = new ICAL.Event(event);
      const description = event.getFirstPropertyValue("description") || "";
      return {
        ...parseEventInfo(icalEvent.summary, description),
        startDate: icalEvent.startDate.toJSDate(),
        endDate: icalEvent.endDate.toJSDate(),
      };
    })
    .reduce((acc, curr) => {
      const overlap = acc.find(
        (event) =>
          (curr.startDate >= event.startDate &&
            curr.startDate <= event.endDate) ||
          (curr.endDate >= event.startDate && curr.endDate <= event.endDate)
      );

      if (!overlap) return [...acc, curr];

      if (overlap.courseName === curr.courseName) {
        overlap.teacher = [overlap.teacher, curr.teacher]
          .filter(Boolean)
          .join(", ");
        overlap.groups = [...new Set([...overlap.groups, ...curr.groups])];
      } else {
        overlap.courseName += ` / ${curr.courseName}`;
        overlap.teacher = [overlap.teacher, curr.teacher]
          .filter(Boolean)
          .join(", ");
        overlap.groups = [...new Set([...overlap.groups, ...curr.groups])];
      }
      return acc;
    }, [])
    .sort((a, b) => a.startDate - b.startDate);
};

// UI Update Functions
const updateUIState = () => {
  document.querySelectorAll(".schedule-table, .current-event").forEach((el) => {
    el.classList.toggle("loading", state.isLoading);
  });

  DOM_ELEMENTS.scheduleError.style.display = state.hasError ? "flex" : "none";
  if (state.hasError) {
    DOM_ELEMENTS.scheduleErrorText.textContent = state.errorMessage;
  }
};

const getEventMessage = (event, timeStr) => {
  const subject = Object.entries(MUSIC_SUBJECTS).find(([, value]) =>
    event.courseName.includes(value)
  );
  return subject ? MESSAGES[subject[1]] : `${timeStr} kvar`;
};

const updateDisplay = (() => {
  let lastUpdate = 0,
    lastEvent = null;

  const update = () => {
    const now = new Date();
    if (now - lastUpdate < CONFIG.REFRESH_INTERVAL) return;
    lastUpdate = now;

    DOM_ELEMENTS.dateDisplay.textContent = FORMATTERS.date.format(now);

    const currentEvent = state.events.find(
      (event) => now >= event.startDate && now <= event.endDate
    );

    const nextEvent = state.events.find((event) => now < event.startDate);

    if (currentEvent) {
      DOM_ELEMENTS.eventStatus.textContent = "● Pågår nu";
      DOM_ELEMENTS.eventStatus.className = "event-status status-ongoing";
      DOM_ELEMENTS.eventName.textContent = currentEvent.courseName;
      DOM_ELEMENTS.eventTeacher.textContent = CONFIG.SHOW_TEACHERS
        ? currentEvent.teacher
        : "";
      const endTime = FORMATTERS.time.format(currentEvent.endDate);
      DOM_ELEMENTS.eventTime.textContent = `Slutar ${endTime}`;
    } else if (nextEvent) {
      DOM_ELEMENTS.eventStatus.textContent = "○ Kommande";
      DOM_ELEMENTS.eventStatus.className = "event-status status-upcoming";
      DOM_ELEMENTS.eventName.textContent = nextEvent.courseName;
      DOM_ELEMENTS.eventTeacher.textContent = CONFIG.SHOW_TEACHERS
        ? nextEvent.teacher
        : "";
      const startTime = FORMATTERS.time.format(nextEvent.startDate);
      DOM_ELEMENTS.eventTime.textContent = `Börjar ${startTime}`;
    } else {
      DOM_ELEMENTS.eventStatus.textContent = "Inga fler aktiviteter idag";
      DOM_ELEMENTS.eventStatus.className = "event-status";
      DOM_ELEMENTS.eventName.textContent = "Inga fler aktiviteter idag";
      DOM_ELEMENTS.eventTeacher.textContent = "";
      DOM_ELEMENTS.eventTime.textContent = "";
    }

    if (currentEvent) {
      const total = currentEvent.endDate - currentEvent.startDate,
        elapsed = now - currentEvent.startDate,
        progress = (elapsed / total) * 100;
      DOM_ELEMENTS.progressBar.style.transform = `scaleX(${progress / 100})`;
    } else {
      DOM_ELEMENTS.progressBar.style.transform = "scaleX(0)";
    }
  };

  const animate = () => {
    update();
    state.animationFrameId = requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
  return update;
})();

const updateScheduleTable = () => {
  if (!DOM_ELEMENTS.scheduleBody) return;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const todayEvents = state.events.filter(
    (event) =>
      (event.startDate >= startOfDay && event.startDate <= endOfDay) ||
      (event.endDate >= startOfDay && event.endDate <= endOfDay) ||
      (event.startDate <= startOfDay && event.endDate >= endOfDay)
  );

  DOM_ELEMENTS.scheduleBody.innerHTML = todayEvents
    .map((event) => {
      const startTime = FORMATTERS.time.format(event.startDate),
        endTime = FORMATTERS.time.format(event.endDate),
        duration = formatTimeRemaining(event.endDate - event.startDate);

      return `
                <tr class="${
                  now >= event.startDate && now <= event.endDate
                    ? "current"
                    : ""
                }">
                    <td>${startTime} - ${endTime}</td>
                    <td>${event.courseName}</td>
                    <td>${duration}</td>
                    <td>${event.groups
                      .slice(0, CONFIG.MAX_GROUPS)
                      .join(", ")}</td>
                </tr>
            `;
    })
    .join("");
};

const toggleSchedule = () => {
  document.querySelector(".schedule-table").classList.toggle("visible");
};

// Fetch ICS file from Timedit
async function fetchTimeditSchedule() {
  try {
    state.isLoading = true;
    updateUIState();

    const response = await fetch(CONFIG.TIMEDIT_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch schedule from Timedit");
    }

    const icsData = await response.text();

    // Save to local storage
    localStorage.setItem("mp2_schedule", icsData);

    // Save timestamp of last fetch
    localStorage.setItem("last_schedule_fetch", Date.now().toString());

    // Process the events
    state.events = processEvents(icsData);

    state.isLoading = false;
    state.hasError = false;
    updateUIState();
    updateDisplay();
    updateScheduleTable();
  } catch (error) {
    console.error("Error fetching Timedit schedule:", error);
    state.isLoading = false;
    state.hasError = true;
    state.errorMessage = "Failed to fetch schedule. Please try again later.";
    updateUIState();
  }
}

// Function to check and fetch schedule if needed
function checkAndUpdateSchedule() {
  const lastFetch = localStorage.getItem("last_schedule_fetch");
  const currentTime = Date.now();

  if (
    !lastFetch ||
    currentTime - parseInt(lastFetch) > CONFIG.AUTO_FETCH_INTERVAL
  ) {
    fetchTimeditSchedule();
  }
}

// Initialize
DOM_ELEMENTS.schemaSelect.addEventListener("change", (e) => {
  const selectedSchema = e.target.value;
  localStorage.setItem("lastSelectedSchema", selectedSchema);
  if (selectedSchema === "mp2") {
    fetchTimeditSchedule();
  } else {
    loadSchema(selectedSchema);
  }
});

// Set up automatic schedule checking
setInterval(checkAndUpdateSchedule, CONFIG.AUTO_FETCH_INTERVAL);

// Initial load
const savedSchema = localStorage.getItem("lastSelectedSchema") || "mp1";
DOM_ELEMENTS.schemaSelect.value = savedSchema;
if (savedSchema === "mp2") {
  const cachedSchedule = localStorage.getItem("mp2_schedule");
  if (cachedSchedule) {
    state.events = processEvents(cachedSchedule);
    updateDisplay();
    updateScheduleTable();
  } else {
    fetchTimeditSchedule();
  }
} else {
  loadSchema(savedSchema);
}
setInterval(updateDisplay, CONFIG.REFRESH_INTERVAL);
setInterval(updateClock, CONFIG.REFRESH_INTERVAL);
updateClock();

const cleanupResources = () => {
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
  }
  state.events = [];
};

const CACHE_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  version: "1.0",
};

const clearStaleCache = () => {
  const cacheTimestamp = localStorage.getItem("cache_timestamp");
  if (
    cacheTimestamp &&
    Date.now() - parseInt(cacheTimestamp) > CACHE_CONFIG.maxAge
  ) {
    localStorage.removeItem("mp2_schedule");
    localStorage.removeItem("cache_timestamp");
  }
};
