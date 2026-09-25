const ACTIVITIES = ['Wash', 'Out', 'Reach', 'Poop', 'OP'];
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);
let currentUser = null;
const WHEEL_ITEM_HEIGHT = 52;
let pickerState = null;
const wheelTimers = new WeakMap();
const programmaticWheelTimers = new WeakMap();

const pad = value => String(value).padStart(2, '0');

function localDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function today() {
  return localDateString(new Date());
}

function toast(text) {
  const element = $('#toast');
  element.textContent = text;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2300);
}

function populateWheel(element, count, label) {
  element.innerHTML = Array.from({ length: count }, (_, value) =>
    `<div id="${element.id}-${value}" class="wheel-option" role="option" aria-label="${label} ${pad(value)}" aria-selected="false" data-value="${value}">${pad(value)}</div>`
  ).join('');
}

function updateWheelSelection(element, value) {
  const bounded = Math.max(0, Math.min(element.children.length - 1, value));
  [...element.children].forEach((option, index) => {
    const selected = index === bounded;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-selected', String(selected));
  });
  element.setAttribute('aria-activedescendant', `${element.id}-${bounded}`);
  if (pickerState) {
    pickerState[element.dataset.part] = bounded;
    $('#selectedTimeAnnouncement').textContent = `Selected time ${pad(pickerState.hour)}:${pad(pickerState.minute)}`;
  }
}

function wheelValue(element) {
  return Math.max(0, Math.min(element.children.length - 1, Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)));
}

function setWheelValue(element, value, smooth = false) {
  element.dataset.programmatic = 'true';
  clearTimeout(programmaticWheelTimers.get(element));
  element.scrollTo({ top: value * WHEEL_ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' });
  updateWheelSelection(element, value);
  programmaticWheelTimers.set(element, setTimeout(() => {
    element.dataset.programmatic = 'false';
  }, 160));
}

function settleWheel(element) {
  clearTimeout(wheelTimers.get(element));
  wheelTimers.set(element, setTimeout(() => {
    if (element.dataset.programmatic === 'true') return;
    const value = wheelValue(element);
    setWheelValue(element, value);
  }, 90));
}

function changeWheelValue(element, change) {
  const current = wheelValue(element);
  const maximum = element.children.length - 1;
  const next = change === 'home' ? 0 : change === 'end' ? maximum : Math.max(0, Math.min(maximum, current + change));
  setWheelValue(element, next);
}

function formatPickedDate(value) {
  if (value === today()) return 'Today';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }).format(parseLocalDate(value));
}

function showTimeView(focusTarget = true) {
  $('#calendarView').hidden = true;
  $('#timePickerView').hidden = false;
  $('#selectedDateLabel').textContent = formatPickedDate(pickerState.date);
  if (focusTarget) $('#openCalendarBtn').focus();
}

function calendarBounds() {
  const maximum = parseLocalDate(today());
  const minimum = new Date(maximum);
  minimum.setDate(minimum.getDate() - 29);
  return { minimum, maximum };
}

function sameMonth(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

function renderCalendar() {
  const { minimum, maximum } = calendarBounds();
  const month = pickerState.calendarMonth;
  $('#calendarMonthLabel').textContent = new Intl.DateTimeFormat(undefined, {
    month: 'long', year: 'numeric'
  }).format(month);
  $('#previousMonthBtn').disabled = sameMonth(month, minimum);
  $('#nextMonthBtn').disabled = sameMonth(month, maximum);

  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday }, () => '<span class="calendar-blank" aria-hidden="true"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const value = localDateString(date);
    const disabled = date < minimum || date > maximum;
    const selected = value === pickerState.date;
    const isToday = value === today();
    const fullLabel = new Intl.DateTimeFormat(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).format(date);
    cells.push(`<button type="button" role="gridcell" data-date="${value}" aria-label="${escapeHTML(fullLabel)}" aria-selected="${selected}" ${disabled ? 'disabled' : ''} class="calendar-day${selected ? ' selected' : ''}${isToday ? ' today' : ''}">${day}</button>`);
  }
  $('#calendarGrid').innerHTML = cells.join('');
}

function showCalendar() {
  pickerState.calendarMonth = new Date(parseLocalDate(pickerState.date).getFullYear(), parseLocalDate(pickerState.date).getMonth(), 1);
  $('#timePickerView').hidden = true;
  $('#calendarView').hidden = false;
  renderCalendar();
  $('#calendarBackBtn').focus();
}

function openPicker(activity, button) {
  const now = new Date();
  now.setSeconds(0, 0);
  pickerState = {
    activity,
    date: localDateString(now),
    hour: now.getHours(),
    minute: now.getMinutes(),
    opener: button,
    calendarMonth: new Date(now.getFullYear(), now.getMonth(), 1)
  };
  $('#pickerActivity').textContent = activity;
  showTimeView(false);
  $('#pickerBackdrop').hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    if (!pickerState || $('#pickerBackdrop').hidden) return;
    setWheelValue($('#hourWheel'), pickerState.hour);
    setWheelValue($('#minuteWheel'), pickerState.minute);
    $('#hourWheel').focus();
  });
}

function closePicker() {
  if ($('#pickerBackdrop').hidden) return;
  const opener = pickerState?.opener;
  $('#pickerBackdrop').hidden = true;
  document.body.classList.remove('modal-open');
  pickerState = null;
  opener?.focus();
}

function pickerFocusableElements() {
  return [...$('#timePicker').querySelectorAll('button:not([disabled]), [tabindex="0"]')]
    .filter(element => !element.closest('[hidden]'));
}

function handlePickerKeydown(event) {
  if ($('#pickerBackdrop').hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closePicker();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = pickerFocusableElements();
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function render() {
  if (!currentUser) return;
  const rows = (await ActivityDB.all(currentUser.id)).filter(record =>
    ACTIVITIES.includes(record.activity)
  );
  const daily = rows.filter(record => record.date === today());
  ACTIVITIES.forEach(activity => {
    const latest = rows.filter(record => record.activity === activity).at(-1);
    const element = document.querySelector(`[data-latest="${activity}"]`);
    if (element) {
      element.textContent = latest
        ? `Latest: ${latest.date === today() ? 'Today' : latest.date} ${latest.time}`
        : 'No records yet';
    }
  });
  $('#todayCount').textContent = `${daily.length} records`;
  $('#summaryList').innerHTML = ACTIVITIES.map(activity => {
    const matches = daily.filter(record => record.activity === activity);
    const value = matches.length ? `${matches.length} · ${matches.at(-1).time}` : '—';
    return `<li><span>${escapeHTML(activity)}</span><b>${value}</b></li>`;
  }).join('');
}

async function record(activity, button, occurredAt) {
  if (!currentUser) return;
  button.disabled = true;
  try {
    const saved = await ActivityDB.add(activity, currentUser.id, occurredAt);
    navigator.vibrate?.(35);
    toast(`✓ ${activity} recorded at ${saved.time}`);
    await render();
    SyncService.sync().then(result => {
      if (result && !result.skipped) updateStatus();
    }).catch(console.warn);
  } catch (error) {
    console.error(error);
    toast('Could not save the record. Please try again.');
  } finally {
    button.disabled = false;
  }
}

async function confirmPicker() {
  if (!pickerState || !currentUser) return;
  const pendingState = pickerState;
  $('#confirmPickerBtn').disabled = true;
  await new Promise(resolve => setTimeout(resolve, 250));
  if (pickerState !== pendingState) {
    $('#confirmPickerBtn').disabled = false;
    return;
  }
  for (const wheel of document.querySelectorAll('.time-wheel')) {
    pickerState[wheel.dataset.part] = wheelValue(wheel);
  }
  const [year, month, day] = pickerState.date.split('-').map(Number);
  const occurredAt = new Date(year, month - 1, day, pickerState.hour, pickerState.minute, 0, 0);
  const { activity, opener } = pickerState;
  try {
    closePicker();
    await record(activity, opener, occurredAt);
  } finally {
    $('#confirmPickerBtn').disabled = false;
  }
}

function updateStatus() {
  if (!currentUser) return;
  const online = navigator.onLine;
  $('#statusDot').classList.toggle('offline', !online);
  $('#statusText').textContent = online ? 'Online · private sync' : 'Offline · saved locally';
}

async function applySession(session) {
  currentUser = session?.user || null;
  $('#authGate').hidden = Boolean(currentUser);
  $('#appMain').hidden = !currentUser;
  $('#appNav').hidden = !currentUser;
  if (!currentUser) {
    closePicker();
    return;
  }
  $('#accountLabel').textContent = currentUser.email || 'Signed in';
  updateStatus();
  await render();
  if (navigator.onLine) {
    try {
      await SyncService.sync();
      await render();
    } catch (error) {
      console.warn(error);
    }
  }
}

async function init() {
  await ActivityDB.open();
  populateWheel($('#hourWheel'), 24, 'Hour');
  populateWheel($('#minuteWheel'), 60, 'Minute');
  $('#hourWheel').dataset.part = 'hour';
  $('#minuteWheel').dataset.part = 'minute';
  document.querySelectorAll('.add-activity').forEach(button =>
    button.addEventListener('click', () => openPicker(button.dataset.activity, button))
  );
  document.querySelectorAll('.time-wheel').forEach(wheel => {
    wheel.addEventListener('scroll', () => {
      settleWheel(wheel);
    }, { passive: true });
    wheel.addEventListener('pointerdown', () => {
      wheel.dataset.programmatic = 'false';
    }, { passive: true });
    wheel.addEventListener('click', event => {
      const option = event.target.closest('.wheel-option');
      if (option) setWheelValue(wheel, Number(option.dataset.value));
    });
    wheel.addEventListener('keydown', event => {
      const changes = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5, Home: 'home', End: 'end' };
      if (!(event.key in changes)) return;
      event.preventDefault();
      changeWheelValue(wheel, changes[event.key]);
    });
  });
  $('#closePickerBtn').addEventListener('click', closePicker);
  $('#cancelPickerBtn').addEventListener('click', closePicker);
  $('#confirmPickerBtn').addEventListener('click', confirmPicker);
  $('#openCalendarBtn').addEventListener('click', showCalendar);
  $('#calendarBackBtn').addEventListener('click', () => showTimeView());
  $('#calendarDoneBtn').addEventListener('click', () => showTimeView());
  $('#previousMonthBtn').addEventListener('click', () => {
    pickerState.calendarMonth = new Date(pickerState.calendarMonth.getFullYear(), pickerState.calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  $('#nextMonthBtn').addEventListener('click', () => {
    pickerState.calendarMonth = new Date(pickerState.calendarMonth.getFullYear(), pickerState.calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  $('#calendarGrid').addEventListener('click', event => {
    const day = event.target.closest('[data-date]:not([disabled])');
    if (!day) return;
    pickerState.date = day.dataset.date;
    showTimeView();
  });
  $('#pickerBackdrop').addEventListener('click', event => {
    if (event.target === event.currentTarget) closePicker();
  });
  document.addEventListener('keydown', handlePickerKeydown);
  document.querySelectorAll('[data-auth-login]').forEach(button =>
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await AuthService.signIn(); }
      catch (error) { console.error(error); toast('Google sign-in failed. Please try again.'); }
      finally { button.disabled = false; }
    })
  );
  $('#signOutBtn').addEventListener('click', () => AuthService.signOut().catch(console.error));
  $('#resetLocalBtn').addEventListener('click', async () => {
    if (!currentUser || !confirm('Clear local records on this device? Cloud records will return on the next sync.')) return;
    await ActivityDB.clear(currentUser.id);
    await render();
    toast('✓ Local records cleared');
  });
  $('#syncBtn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      toast('Syncing with Supabase…');
      const result = await SyncService.connect();
      await render();
      toast(result.skipped ? 'Sync unavailable. Records remain local.' : `✓ Synced · ${result.uploaded} uploaded`);
    } catch (error) {
      console.error(error);
      toast('Sync failed. Records remain saved locally.');
    } finally {
      button.disabled = false;
    }
  });
  addEventListener('online', () => {
    updateStatus();
    SyncService.sync().then(render).catch(console.warn);
  });
  addEventListener('offline', updateStatus);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  AuthService.subscribe(session => applySession(session).catch(console.error));
  await applySession(await AuthService.init());
}

document.addEventListener('DOMContentLoaded', init);
