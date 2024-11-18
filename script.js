

const MUSIC_SUBJECTS = Object.freeze({
    ENSEMBLE: "Ensemble",
    GEHOR: "Gehör",
    IMPROVISATION: "Improvisation",
    MUSIKPRODUKTION: "Musikproduktion",
    ESTETISK: "Estetisk kommunikation",
    LUNCH: "Lunch",
  }),
  MESSAGES = Object.freeze({
    [MUSIC_SUBJECTS.ENSEMBLE]: "Dags att jamma tillsammans!",
    [MUSIC_SUBJECTS.GEHOR]: "Träna ditt musikaliska öra!",
    [MUSIC_SUBJECTS.IMPROVISATION]: "Låt kreativiteten flöda!",
    [MUSIC_SUBJECTS.MUSIKPRODUKTION]: "Dags att mixa och producera!",
    [MUSIC_SUBJECTS.ESTETISK]: "Uttryck dig kreativt!",
    [MUSIC_SUBJECTS.LUNCH]: "Dags för lunch!",
  }),
  DOM_ELEMENTS = Object.freeze(
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
      ].map((id) => [id, document.getElementById(id)])
    )
  );
let events = [],
  animationFrameId = null,
  scrollPosition = window.pageYOffset;

const REFRESH_INTERVAL = 1000,
  SHOW_TEACHERS = false,
  MAX_TEACHERS = 2,
  MAX_GROUPS = 4,
  CACHE_NAME = "schema-cache",
  PARALLAX_SPEED = 0.5,
  dateFormatter = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  timeFormatter = new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

const apply3DTransform = (element, depth = 20) => {
  const rect = element.getBoundingClientRect(),
    centerX = rect.left + rect.width / 2,
    centerY = rect.top + rect.height / 2,
    mouseX = event.clientX - centerX,
    mouseY = event.clientY - centerY,
    rotateX = (mouseY / centerY) * depth,
    rotateY = -(mouseX / centerX) * depth;

  element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
};
const updateParallax = () => {
  const elements = document.querySelectorAll(".parallax");
  elements.forEach((element) => {
    const speed = element.dataset.speed || PARALLAX_SPEED,
      yPos = -(scrollPosition * speed);
    element.style.transform = `translate3d(0, ${yPos}px, 0)`;
  });
};

window.addEventListener("scroll", () => {
  scrollPosition = window.pageYOffset;
  updateParallax();
});

window.addEventListener("mousemove", (event) => {
  requestAnimationFrame(() => {
    document.querySelectorAll(".depth-effect").forEach((element) => {
      apply3DTransform(element);
    });
  });
});

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

    const dateStr = dateFormatter.format(now),
      [weekday, ...rest] = dateStr.split(" ");
    DOM_ELEMENTS.dateDisplay.textContent =
      weekday.charAt(0).toUpperCase() +
      weekday.slice(1) +
      " " +
      rest
        .map((word, i) =>
          i === 1 ? word.charAt(0).toUpperCase() + word.slice(1) : word
        )
        .join(" ");
  });
};

const parseEventInfo = (summary) => {
  const groupPattern = /(AM|MP|LA)\d+[a-d]?/g,
    combinedPattern = /(?:AM|MP|LA)+\d+[a-d]?/g,
    groups = new Set([
      ...(summary.match(groupPattern) || []),
      ...(summary.match(combinedPattern) || []).flatMap((group) => {
        const num = group.match(/\d+[a-d]?/)[0];
        return (group.match(/(AM|MP|LA)/g) || []).map(
          (prefix) => `${prefix}${num}`
        );
      }),
    ]);

  const cleanSummary = summary
      .replace(combinedPattern, "")
      .replace(groupPattern, "")
      .replace(/,\s*,/g, ",")
      .trim(),
    [courseName, ...teacherParts] = cleanSummary.includes("\\,")
      ? cleanSummary.split("\\,")
      : cleanSummary.split(",");

  return {
    teacher: teacherParts
      .join(cleanSummary.includes("\\,") ? "\\," : "")
      .trim(),
    courseName: courseName.trim(),
    groups: [...groups],
  };
};

const loadSchema = async (schemaId) => {
  try {
    const cache = await caches.open(CACHE_NAME),
      response =
        (await cache.match(`/scheman/${schemaId}.ics`)) ||
        (await fetch(`/scheman/${schemaId}.ics`).then((res) => {
          cache.put(`/scheman/${schemaId}.ics`, res.clone());
          return res;
        })),
      data = await response.text();

    events = new ICAL.Component(ICAL.parse(data))
      .getAllSubcomponents("vevent")
      .map((event) => {
        const icalEvent = new ICAL.Event(event);
        return {
          ...parseEventInfo(icalEvent.summary),
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

    updateDisplay();
    updateScheduleTable();
  } catch (error) {
    console.error("Fel vid laddning av schema:", error);
  }
};
const formatTimeRemaining = (ms) => {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000),
    hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}t ${minutes % 60}m` : `${minutes}m`;
};

const getEventMessage = (event, timeStr) => {
  const subject = Object.values(MUSIC_SUBJECTS).find((subj) =>
    event.courseName.includes(subj)
  );
  return subject ? `${MESSAGES[subject]} ${timeStr}` : timeStr;
};

const updateDisplay = (() => {
  let lastUpdate = 0,
    lastEvent = null;

  const update = () => {
    const now = Date.now();
    if (now - lastUpdate < 100) return;
    lastUpdate = now;

    const currentEvent = events.find(
      (event) => now >= event.startDate && now <= event.endDate
    );

    if (currentEvent) {
      const progress =
          ((now - currentEvent.startDate) /
            (currentEvent.endDate - currentEvent.startDate)) *
          100,
        timeRemaining = formatTimeRemaining(currentEvent.endDate - now);

      if (
        !lastEvent ||
        lastEvent.id !== currentEvent.startDate.getTime() ||
        lastEvent.timeRemaining !== timeRemaining
      ) {
        DOM_ELEMENTS.currentEventHeader.textContent = "Just nu";
        DOM_ELEMENTS.eventName.textContent = currentEvent.courseName;
        DOM_ELEMENTS.eventTeacher.textContent = `${
          currentEvent.teacher || ""
        } ${currentEvent.groups.join(", ")}`;
        DOM_ELEMENTS.eventTime.textContent = getEventMessage(
          currentEvent,
          `(${timeRemaining} kvar)`
        );
        lastEvent = {
          id: currentEvent.startDate.getTime(),
          timeRemaining,
        };
      }
      DOM_ELEMENTS.progressBar.style.transform = `perspective(1000px) scaleX(${
        Math.min(100, Math.max(0, progress)) / 100
      }) translateZ(10px)`;
    } else {
      const nextEvent = events.find((event) => now < event.startDate);
      if (nextEvent) {
        const timeUntilNext = nextEvent.startDate - now;
        const timeRemaining = formatTimeRemaining(timeUntilNext);

        if (
          !lastEvent ||
          lastEvent.id !== nextEvent.startDate.getTime() ||
          lastEvent.timeRemaining !== timeRemaining
        ) {
          DOM_ELEMENTS.currentEventHeader.textContent = "Härnäst";
          DOM_ELEMENTS.eventName.textContent = nextEvent.courseName;
          DOM_ELEMENTS.eventTeacher.textContent = `${
            nextEvent.teacher || ""
          } ${nextEvent.groups.join(", ")}`;
          DOM_ELEMENTS.eventTime.textContent = `Börjar om ${timeRemaining}`;
          lastEvent = {
            id: nextEvent.startDate.getTime(),
            timeRemaining,
          };
        }
        DOM_ELEMENTS.progressBar.style.transform =
          "perspective(1000px) scaleX(0) translateZ(10px)";
      } else if (lastEvent !== null) {
        DOM_ELEMENTS.currentEventHeader.textContent = "Idag";
        DOM_ELEMENTS.eventName.textContent = "Inga fler lektioner";
        DOM_ELEMENTS.eventTeacher.textContent = "";
        DOM_ELEMENTS.eventTime.textContent = "Dags för egen övning!";
        DOM_ELEMENTS.progressBar.style.transform =
          "perspective(1000px) scaleX(0) translateZ(10px)";
        lastEvent = null;
      }
    }
  };

  // Start a continuous update loop using requestAnimationFrame
  const animate = () => {
    update();
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  return update;
})();

const updateScheduleTable = () => {
  const now = Date.now();
  const today = new Date().setHours(0, 0, 0, 0),
    todayEvents = events.filter(
      (event) => new Date(event.startDate).setHours(0, 0, 0, 0) === today
    );
  DOM_ELEMENTS.scheduleBody.innerHTML = todayEvents.length
    ? todayEvents
        .map((event) => {
          const startTime = timeFormatter.format(event.startDate),
            endTime = timeFormatter.format(event.endDate),
            duration = formatTimeRemaining(event.endDate - event.startDate),
            teacherInfo =
              SHOW_TEACHERS &&
              event.teacher &&
              event.teacher.split(",").length <= MAX_TEACHERS
                ? ` - ${event.teacher}`
                : "",
            groupInfo = event.groups.length
              ? ` (${event.groups.slice(0, MAX_GROUPS).join(", ")}${
                  event.groups.length > MAX_GROUPS ? "..." : ""
                })`
              : "";

          let status = '';
          if (now >= event.endDate) {
            status = 'completed';
          } else if (now >= event.startDate && now <= event.endDate) {
            const progress = ((now - event.startDate) / (event.endDate - event.startDate)) * 100;
            status = `ongoing" style="background: linear-gradient(to right, rgba(0, 255, 0, 0.2) ${progress}%, transparent ${progress}%)`;
          }

          return `<tr class="depth-effect ${status}"><td>${startTime}-${endTime}</td><td>${event.courseName}${teacherInfo}</td><td>${duration}</td><td>${groupInfo}</td></tr>`;
        })
        .join("")
    : '<tr class="depth-effect"><td colspan="3">Inga lektioner idag</td></tr>';
};

const toggleSchedule = () =>
  document.getElementById("scheduleTable").classList.toggle("visible");
// Save the selected schedule to localStorage
DOM_ELEMENTS.schemaSelect.addEventListener("change", (e) => {
  const selectedSchema = e.target.value;
  localStorage.setItem("lastSelectedSchema", selectedSchema);
  loadSchema(selectedSchema);
});

// Load the last selected schedule on page load
(() => {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  loadTests().then(() => {
    const lastSelectedSchema = localStorage.getItem("lastSelectedSchema") || "Mp2";
    DOM_ELEMENTS.schemaSelect.value = lastSelectedSchema;
    loadSchema(lastSelectedSchema);
  });
  setInterval(updateDisplay, REFRESH_INTERVAL);
  setInterval(updateClock, REFRESH_INTERVAL);
  updateClock();
})();


=======
  loadSchema("Mp2");
  setInterval(updateDisplay, REFRESH_INTERVAL);
  setInterval(updateClock, REFRESH_INTERVAL);
  updateClock();
})();
>>>>>>> parent of faa1ed0 (Refactor: Improve code structure and readability)
=======
  loadSchema("Mp2");
  setInterval(updateDisplay, REFRESH_INTERVAL);
  setInterval(updateClock, REFRESH_INTERVAL);
  updateClock();
})();
>>>>>>> parent of faa1ed0 (Refactor: Improve code structure and readability)
=======
  loadSchema("Mp2");
  setInterval(updateDisplay, REFRESH_INTERVAL);
  setInterval(updateClock, REFRESH_INTERVAL);
  updateClock();
})();
>>>>>>> parent of faa1ed0 (Refactor: Improve code structure and readability)
