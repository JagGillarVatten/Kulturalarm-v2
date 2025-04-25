const debounce = (callback, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId), (timeoutId = setTimeout(() => callback(...args), delay));
    };
  },
  formatTimeRemaining = (milliseconds) =>
    milliseconds < 6e4
      ? `${Math.floor(milliseconds / 1e3)}s`
      : ((minutes = Math.floor(milliseconds / 6e4)),
        (hours = Math.floor(minutes / 60)),
        hours > 0 ? `${hours}t ${minutes % 60}m` : `${minutes}m`);
var minutes, hours;

const updateClock = () => {
    const currentDate = new Date(),
      seconds = currentDate.getSeconds(),
      minutes = currentDate.getMinutes(),
      hours = currentDate.getHours() % 12;
    (DOM_ELEMENTS.hour.style.transform = `rotate(${30 * hours + minutes / 2}deg)`),
      (DOM_ELEMENTS.minute.style.transform = `rotate(${6 * minutes}deg)`),
      (DOM_ELEMENTS.second.style.transform = `rotate(${6 * seconds}deg)`),
      (DOM_ELEMENTS.digitalClock.textContent = `${currentDate
        .getHours()
        .toString()
        .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
  },
  parseEventInfo = (eventSummary, eventDescription = "") => {
    try {
      const eventParts = eventSummary.split(",").map((part) => part.trim()),
        courseName = eventParts[0].replace(/(?:AML|LA|MP)\d+[a-d]?/gi, '').trim(),
        teacher = eventParts.find((part) => !part.match(/AML|MP|LA/)) || "",
        courseCodePattern = /(?:AM|LA|MP)\d+[a-d]?/g,
        summaryCourseCodes = eventSummary.match(courseCodePattern) || [],
        descriptionCourseCodes = eventDescription.match(courseCodePattern) || [],
        uniqueCourseCodes = [...new Set([...summaryCourseCodes, ...descriptionCourseCodes])].map((courseCode) => {
          const numberMatch = courseCode.match(/\d+/),
            letterMatch = courseCode.match(/[a-d]$/),
            courseNumber = numberMatch ? numberMatch[0] : "",
            courseLetter = letterMatch ? letterMatch[0].toLowerCase() : "",
            courseVariants = [];
          
          if (courseCode.includes("AML")) {
            courseVariants.push(`AM${courseNumber}`);
            courseVariants.push(`LA${courseNumber}`);
            courseVariants.push(`MP${courseNumber}`);
          } else {
            if (courseCode.includes("AM")) courseVariants.push(`AM${courseNumber}`);
            if (courseCode.includes("LA")) courseVariants.push(`LA${courseNumber}`);
            if (courseCode.includes("MP")) courseVariants.push(`MP${courseNumber}`);
          }

          return courseLetter ? `${courseVariants.join(" ")} ${courseLetter}` : courseVariants.join(" ");
        });
      return {
        courseName: courseName || "Okänd aktivitet",
        teacher: teacher,
        groups: uniqueCourseCodes,
        rawDescription: eventDescription,
      };
    } catch (error) {
      console.error("Error parsing event info:", error);
      return {
        courseName: eventSummary.replace(/(?:AM|LA|MP)\d+[a-d]?/gi, '').trim() || "Okänd aktivitet",
        teacher: "",
        groups: [],
        rawDescription: eventDescription,
      };
    }
  },
  processEvents = (calendarData) =>
    new ICAL.Component(ICAL.parse(calendarData))
      .getAllSubcomponents("vevent")
      .map((eventComponent) => {
        const event = new ICAL.Event(eventComponent),
          eventDescription = eventComponent.getFirstPropertyValue("description") || "";
        return {
          ...parseEventInfo(event.summary, eventDescription),
          startDate: event.startDate.toJSDate(),
          endDate: event.endDate.toJSDate(),
        };
      })
      .reduce((processedEvents, currentEvent) => {
        const overlappingEvent = processedEvents.find(
          (existingEvent) =>
            (currentEvent.startDate >= existingEvent.startDate && currentEvent.startDate <= existingEvent.endDate) ||
            (currentEvent.endDate >= existingEvent.startDate && currentEvent.endDate <= existingEvent.endDate)
        );
        return overlappingEvent
          ? (overlappingEvent.courseName === currentEvent.courseName
              ? ((overlappingEvent.teacher = [overlappingEvent.teacher, currentEvent.teacher]
                  .filter(Boolean)
                  .join(", ")),
                (overlappingEvent.groups = [...new Set([...overlappingEvent.groups, ...currentEvent.groups])]))
              : ((overlappingEvent.courseName += ` / ${currentEvent.courseName}`),
                (overlappingEvent.teacher = [overlappingEvent.teacher, currentEvent.teacher].filter(Boolean).join(", ")),
                (overlappingEvent.groups = [...new Set([...overlappingEvent.groups, ...currentEvent.groups])])),
            processedEvents)
          : [...processedEvents, currentEvent];
      }, [])
      .sort((a, b) => a.startDate - b.startDate),
  updateUIState = () => {
    document
      .querySelectorAll(".schedule-table, .current-event")
      .forEach((element) => {
        element.classList.toggle("loading", state.isLoading);
      }),
      (DOM_ELEMENTS.scheduleError.style.display = state.hasError
        ? "flex"
        : "none"),
      state.hasError &&
        (DOM_ELEMENTS.scheduleErrorText.textContent = state.errorMessage);
    
    DOM_ELEMENTS.customUrlContainer.style.display = state.isManagingCustomSchemas ? "flex" : "none";
  }
  const updateDisplay = (() => {
    let lastUpdateTime = 0;
    const updateDisplayContent = () => {
      const currentTime = new Date();
      if (!(currentTime - lastUpdateTime < CONFIG.REFRESH_INTERVAL)) {
        (lastUpdateTime = currentTime),
          (DOM_ELEMENTS.dateDisplay.textContent = FORMATTERS.date.format(currentTime));
        const currentEvent = state.events.find((event) => currentTime >= event.startDate && currentTime <= event.endDate),
          nextEvent = state.events.find((event) => {
            const timeDiff = event.startDate - currentTime;
            return currentTime < event.startDate && timeDiff < 24 * 60 * 60 * 1000; // Less than 24 hours
          });
        if (
          (currentEvent && currentEvent.courseName.toLowerCase() !== "lunch"
            ? ((DOM_ELEMENTS.eventStatus.textContent = "● Pågår nu"),
              (DOM_ELEMENTS.eventStatus.className =
                "event-status status-ongoing"),
              (DOM_ELEMENTS.eventName.textContent = currentEvent.courseName),
              (DOM_ELEMENTS.eventTeacher.textContent = CONFIG.SHOW_TEACHERS
                ? currentEvent.teacher
                : ""),
              (DOM_ELEMENTS.eventTime.textContent = `Slutar ${FORMATTERS.time.format(
                currentEvent.endDate
              )}`),
              (DOM_ELEMENTS.timeRemaining.textContent = formatTimeRemaining(
                currentEvent.endDate - currentTime
              )))
            : nextEvent
            ? ((DOM_ELEMENTS.eventStatus.textContent = "○ Kommande"),
              (DOM_ELEMENTS.eventStatus.className =
                "event-status status-upcoming"),
              (DOM_ELEMENTS.eventName.textContent = nextEvent.courseName),
              (DOM_ELEMENTS.eventTeacher.textContent = CONFIG.SHOW_TEACHERS
                ? nextEvent.teacher
                : ""),
              (DOM_ELEMENTS.eventTime.textContent = `Börjar ${FORMATTERS.time.format(
                nextEvent.startDate
              )}`),
              (DOM_ELEMENTS.timeRemaining.textContent = formatTimeRemaining(
                nextEvent.startDate - currentTime
              )))
            : ((DOM_ELEMENTS.eventStatus.textContent =
                "Inga fler aktiviteter idag"),
              (DOM_ELEMENTS.eventStatus.className = "event-status"),
              (DOM_ELEMENTS.eventName.textContent =
                "Inga fler aktiviteter idag"),
              (DOM_ELEMENTS.eventTeacher.textContent = ""),
              (DOM_ELEMENTS.eventTime.textContent = ""),
              (DOM_ELEMENTS.timeRemaining.textContent = "")),
          currentEvent && currentEvent.courseName.toLowerCase() !== "lunch")
        ) {
          const eventDuration = currentEvent.endDate - currentEvent.startDate,
            progressPercentage = ((currentTime - currentEvent.startDate) / eventDuration) * 100;
          DOM_ELEMENTS.progressBar.style.width = `${progressPercentage}%`;
        } else DOM_ELEMENTS.progressBar.style.width = "0";
      }
    };
    return (
      requestAnimationFrame(function animationLoop() {
        updateDisplayContent(), (state.animationFrameId = requestAnimationFrame(animationLoop));
      }),
      updateDisplayContent
    );
  })();
  updateScheduleTable = () => {
    if (!DOM_ELEMENTS.scheduleBody) return;
    const currentDate = new Date(),
      startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999),
      (DOM_ELEMENTS.scheduleBody.innerHTML = state.events
        .filter(
          (event) =>
            (event.startDate >= startOfDay && event.startDate <= endOfDay) ||
            (event.endDate >= startOfDay && event.endDate <= endOfDay) ||
            (event.startDate <= startOfDay && event.endDate >= endOfDay)
        )
        .map((event) => {
          const startTime = FORMATTERS.time.format(event.startDate),
            endTime = FORMATTERS.time.format(event.endDate);
          return `<tr class="${
            currentDate >= event.startDate && currentDate <= event.endDate ? "current" : ""
          }"><td>${startTime} - ${endTime}</td><td>${
            event.courseName
          }</td><td>${formatTimeRemaining(
            event.endDate - event.startDate
          )}</td><td>${event.groups
            .slice(0, CONFIG.MAX_GROUPS)
            .join(", ")}</td></tr>`;
        })
        .join(""));
  },
  toggleSchedule = () => {
    document.querySelector(".schedule-table").classList.toggle("visible");
  };
async function fetchTimeditSchedule(scheduleUrl) {
  try {
    (state.isLoading = !0), updateUIState();
    const response = await fetch(scheduleUrl);
    if (!response.ok) {
      console.error(`Failed to fetch schedule: HTTP ${response.status} - ${response.statusText}`);
      throw new Error("Kunde inte hämta schema från Timedit");
    }
    const calendarData = await response.text();
    setStorageItem("current_schedule", calendarData);
    setStorageItem("last_schedule_fetch", Date.now());
    (state.events = processEvents(calendarData)),
      (state.isLoading = !1),
      (state.hasError = !1),
      updateUIState(),
      updateDisplay(),
      updateScheduleTable();
  } catch (error) {
    console.error("Fel vid hämtning av Timedit-schema:", error),
      (state.isLoading = !1),
      (state.hasError = !0),
      (state.errorMessage =
        "Kunde inte hämta schema. Försök igen senare."),
      updateUIState();
  }
}

async function initializeSchedule() {
  try {
    const storedSchedule = getStorageItem("current_schedule");
    const lastFetchTime = getStorageItem("last_schedule_fetch");
    const currentTime = Date.now();

    if (storedSchedule && lastFetchTime && (currentTime - lastFetchTime) < 24 * 60 * 60 * 1000) {
      state.events = processEvents(storedSchedule);
      updateDisplay();
      updateScheduleTable();
    } else {
      await fetchTimeditSchedule(CONFIG.SCHEDULE_URL);
    }
  } catch (error) {
    console.error("Error initializing schedule:", error);
  }
}

document.addEventListener('DOMContentLoaded', initializeSchedule);