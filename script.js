  const MUSIC_SUBJECTS = Object.freeze({
      ENSEMBLE: 'Ensemble',
      GEHOR: 'Gehör',
      IMPROVISATION: 'Improvisation',
      MUSIKPRODUKTION: 'Musikproduktion',
      ESTETISK: 'Estetisk kommunikation',
      LUNCH: 'Lunch'
  });

  const MESSAGES = Object.freeze({
      [MUSIC_SUBJECTS.ENSEMBLE]: 'Dags att jamma tillsammans!',
      [MUSIC_SUBJECTS.GEHOR]: 'Träna ditt musikaliska öra!',
      [MUSIC_SUBJECTS.IMPROVISATION]: 'Låt kreativiteten flöda!',
      [MUSIC_SUBJECTS.MUSIKPRODUKTION]: 'Dags att mixa och producera!',
      [MUSIC_SUBJECTS.ESTETISK]: 'Uttryck dig kreativt!',
      [MUSIC_SUBJECTS.LUNCH]: 'Dags för lunch!'
  });

  const DOM_ELEMENTS = {
      hourHand: document.getElementById('hourHand'),
      minuteHand: document.getElementById('minuteHand'),
      secondHand: document.getElementById('secondHand'),
      dateDisplay: document.getElementById('dateDisplay'),
      eventName: document.getElementById('eventName'),
      eventTeacher: document.getElementById('eventTeacher'),
      eventTime: document.getElementById('eventTime'),
      progressBar: document.getElementById('progressBar'),
      currentEventHeader: document.getElementById('currentEventHeader'),
      scheduleBody: document.getElementById('scheduleBody'),
      schemaSelect: document.getElementById('schemaSelect')
  };

  let events = [];
  let animationFrameId = null;
  const REFRESH_INTERVAL = 1000;
  const SHOW_TEACHERS = false;
  const MAX_TEACHERS = 2;
  const LONG_BREAK_THRESHOLD = 45 * 60 * 1000;

  const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
  });

  const timeFormatter = new Intl.DateTimeFormat('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit' 
  });

  const updateClock = () => {
      const now = new Date();
      const hours = now.getHours() % 12;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      requestAnimationFrame(() => {
          DOM_ELEMENTS.hourHand.style.transform = `rotate(${(hours + minutes / 60) * 30}deg)`;
          DOM_ELEMENTS.minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
          DOM_ELEMENTS.secondHand.style.transform = `rotate(${seconds * 6}deg)`;
          const formattedDate = dateFormatter.format(now);
          const [weekday, ...rest] = formattedDate.split(' ');
          DOM_ELEMENTS.dateDisplay.textContent = weekday.charAt(0).toUpperCase() + weekday.slice(1) + ' ' + 
              rest.map((word, index) => index === 1 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(' ');
      });
  };

  const parseEventInfo = (summary) => {
      const groupRegex = /(AM|MP|LA)\d+[a-d]?/g;
      const combinedGroupRegex = /(?:AM|MP|LA)+\d+[a-d]?/g;
      
      const groups = new Set([
          ...(summary.match(groupRegex) || []),
          ...(summary.match(combinedGroupRegex) || []).flatMap(combined => {
              const year = combined.match(/\d+[a-d]?/)[0];
              return (combined.match(/(AM|MP|LA)/g) || []).map(program => `${program}${year}`);
          })
      ]);

      const cleanedSummary = summary.replace(combinedGroupRegex, '').replace(groupRegex, '').replace(/,\s*,/g, ',').trim();
      const [courseName, ...teacherParts] = cleanedSummary.includes('\\,') ? 
          cleanedSummary.split('\\,') : 
          cleanedSummary.split(',');

      return {
          teacher: teacherParts.join(cleanedSummary.includes('\\,') ? '\\,' : '').trim(),
          courseName: courseName.trim(),
          groups: [...groups]
      };
  };

  const loadSchema = async (schemaName) => {
      try {
          const cache = await caches.open('schema-cache');
          const response = await cache.match(`/scheman/${schemaName}.ics`) || 
              await fetch(`/scheman/${schemaName}.ics`).then(res => {
                  cache.put(`/scheman/${schemaName}.ics`, res.clone());
                  return res;
              });

          const data = await response.text();
          const comp = new ICAL.Component(ICAL.parse(data));
          
          events = comp.getAllSubcomponents('vevent')
              .map(vevent => {
                  const event = new ICAL.Event(vevent);
                  return {
                      ...parseEventInfo(event.summary),
                      startDate: event.startDate.toJSDate(),
                      endDate: event.endDate.toJSDate()
                  };
              })
              .reduce((acc, curr) => {
                  const overlapping = acc.find(event => 
                      (curr.startDate >= event.startDate && curr.startDate <= event.endDate) ||
                      (curr.endDate >= event.startDate && curr.endDate <= event.endDate)
                  );

                  if (overlapping) {
                      overlapping.courseName += ` / ${curr.courseName}`;
                      overlapping.teacher = [overlapping.teacher, curr.teacher].filter(Boolean).join(', ');
                      overlapping.groups = [...new Set([...overlapping.groups, ...curr.groups])];
                      return acc;
                  }
                  return [...acc, curr];
              }, [])
              .sort((a, b) => a.startDate - b.startDate);

          updateDisplay();
          updateScheduleTable();
      } catch (error) {
          console.error('Fel vid laddning av schema:', error);
      }
  };

  const formatTimeRemaining = (ms) => {
      if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return hours > 0 ? `${hours}t ${remainingMinutes}m` : `${remainingMinutes}m`;
  };

  const getEventMessage = (event, timeRemaining) => {
      const subject = Object.values(MUSIC_SUBJECTS).find(subject => event.courseName.includes(subject));
      return subject ? `${MESSAGES[subject]} ${timeRemaining}` : timeRemaining;
  };


  const updateDisplay = (() => {
      let lastUpdate = 0;
      let currentEventData = null;

      return () => {
          const now = Date.now();
          if (now - lastUpdate < 100) return;
          
          lastUpdate = now;
          const currentEvent = events.find(event => 
              now >= event.startDate && now <= event.endDate);

          if (currentEvent) {
              const progress = ((now - currentEvent.startDate) / (currentEvent.endDate - currentEvent.startDate)) * 100;
              
              // Only update if event or time has changed
              if (!currentEventData || 
                  currentEventData.id !== currentEvent.startDate.getTime() ||
                  currentEventData.timeRemaining !== formatTimeRemaining(currentEvent.endDate - now)) {
                  
                  DOM_ELEMENTS.currentEventHeader.textContent = 'Just nu';
                  DOM_ELEMENTS.eventName.textContent = currentEvent.courseName;
                  DOM_ELEMENTS.eventTeacher.textContent = `${currentEvent.teacher || ''} ${currentEvent.groups.join(', ')}`;
                  DOM_ELEMENTS.eventTime.textContent = getEventMessage(currentEvent, `(${formatTimeRemaining(currentEvent.endDate - now)} kvar)`);
                  
                  currentEventData = {
                      id: currentEvent.startDate.getTime(),
                      timeRemaining: formatTimeRemaining(currentEvent.endDate - now)
                  };
              }
              
              DOM_ELEMENTS.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
          } else {
              const nextEvent = events.find(event => now < event.startDate);
              
              if (nextEvent) {
                  const timeUntilNext = nextEvent.startDate - now;
                  
                  // Only update if event or time has changed
                  if (!currentEventData || 
                      currentEventData.id !== nextEvent.startDate.getTime() ||
                      currentEventData.timeRemaining !== formatTimeRemaining(timeUntilNext)) {
                      
                      DOM_ELEMENTS.currentEventHeader.textContent = 'Härnäst';
                      DOM_ELEMENTS.eventName.textContent = nextEvent.courseName;
                      DOM_ELEMENTS.eventTeacher.textContent = `${nextEvent.teacher || ''} ${nextEvent.groups.join(', ')}`;
                      DOM_ELEMENTS.eventTime.textContent = `Börjar om ${formatTimeRemaining(timeUntilNext)}`;
                      
                      currentEventData = {
                          id: nextEvent.startDate.getTime(),
                          timeRemaining: formatTimeRemaining(timeUntilNext)
                      };
                  }
                  
                  DOM_ELEMENTS.progressBar.style.width = '0%';
              } else {
                  // Only update if state has changed
                  if (currentEventData !== null) {
                      DOM_ELEMENTS.currentEventHeader.textContent = 'Idag';
                      DOM_ELEMENTS.eventName.textContent = 'Inga fler lektioner';
                      DOM_ELEMENTS.eventTeacher.textContent = '';
                      DOM_ELEMENTS.eventTime.textContent = 'Dags för egen övning!';
                      DOM_ELEMENTS.progressBar.style.width = '0%';
                      currentEventData = null;
                  }
              }
          }
      };
  })();

  const updateScheduleTable = () => {
      const today = new Date().setHours(0, 0, 0, 0);
      const todayEvents = events.filter(event => new Date(event.startDate).setHours(0, 0, 0, 0) === today);


      DOM_ELEMENTS.scheduleBody.innerHTML = todayEvents.length ? todayEvents.map(event => {
          const startTime = timeFormatter.format(event.startDate);
          const endTime = timeFormatter.format(event.endDate);
          const duration = formatTimeRemaining(event.endDate - event.startDate);
          const teacherInfo = SHOW_TEACHERS && event.teacher && event.teacher.split(',').length <= MAX_TEACHERS ? 
              ` - ${event.teacher}` : '';
          const groupInfo = event.groups.length ? ` (${event.groups.join(', ')})` : '';








        
          return `
              <tr>
                  <td>${startTime}-${endTime}</td>
                  <td>${event.courseName}${teacherInfo}</td>

                  <td>${duration}</td>

                  <td>${groupInfo}</td>
              </tr>

          `;
      }).join('') : '<tr><td colspan="3">Inga lektioner idag</td></tr>';
  };

  const toggleSchedule = () => document.getElementById('scheduleTable').classList.toggle('visible');
  const toggleDarkMode = () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
  };

  DOM_ELEMENTS.schemaSelect.addEventListener('change', (e) => loadSchema(e.target.value));

  (() => {
      loadSchema('Mp2');
      setInterval(updateDisplay, REFRESH_INTERVAL);
      setInterval(updateClock, REFRESH_INTERVAL);
      updateClock();

      if (localStorage.getItem('darkMode') === 'true') {
          document.body.classList.add('dark-mode');
      }
  })();