// ---------- State ----------
const STORAGE_KEY = 'wakeUpCalculator.v1';

const defaultState = {
  jobStart: '09:00',
  driveMinutes: 20,
  items: [
    { name: 'Shower', minutes: 15 },
    { name: 'Teeth & face', minutes: 5 },
    { name: 'Get dressed', minutes: 10 },
    { name: 'Breakfast', minutes: 15 },
    { name: 'Buffer (keys, bag, walk out)', minutes: 15 },
  ],
};

let state = loadState();
let wakeDate = null;      // Date object for the next computed wake time
let leaveDate = null;     // Date object for when you need to leave home
let alarmTimeoutId = null;
let countdownIntervalId = null;
let armed = false;
let audioCtx = null;
let oscillatorNode = null;
let gainNode = null;

// ---------- Persistence ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    if (!parsed.items || !parsed.items.length) return structuredClone(defaultState);
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (e.g. private browsing) — app still works, just won't persist
  }
}

// ---------- DOM refs ----------
const jobStartInput = document.getElementById('jobStart');
const driveInput = document.getElementById('driveMinutes');
const leaveByRow = document.getElementById('leaveByRow');
const ledgerList = document.getElementById('ledgerList');
const addItemBtn = document.getElementById('addItemBtn');
const wakeTimeDisplay = document.getElementById('wakeTimeDisplay');
const wakeMeta = document.getElementById('wakeMeta');
const armBtn = document.getElementById('armBtn');
const countdownEl = document.getElementById('countdown');
const alarmPanel = document.getElementById('alarmPanel');
const snoozeBtn = document.getElementById('snoozeBtn');
const stopBtn = document.getElementById('stopBtn');

// ---------- Init ----------
jobStartInput.value = state.jobStart;
driveInput.value = state.driveMinutes;
renderLedger();
recalculate();

jobStartInput.addEventListener('change', () => {
  state.jobStart = jobStartInput.value;
  saveState();
  recalculate();
});
driveInput.addEventListener('input', () => {
  state.driveMinutes = Number(driveInput.value) || 0;
  saveState();
  recalculate();
});
addItemBtn.addEventListener('click', () => {
  state.items.push({ name: 'New step', minutes: 5 });
  saveState();
  renderLedger();
  recalculate();
});
armBtn.addEventListener('click', () => {
  if (armed) disarm(); else arm();
});
snoozeBtn.addEventListener('click', () => {
  stopAlarmSound();
  alarmPanel.hidden = true;
  const snoozeDate = new Date(Date.now() + 5 * 60000);
  scheduleAlarm(snoozeDate);
  armBtn.textContent = 'Disarm alarm';
  armed = true;
});
stopBtn.addEventListener('click', () => {
  stopAlarmSound();
  alarmPanel.hidden = true;
  disarm();
});

// ---------- Ledger rendering ----------
function renderLedger() {
  ledgerList.innerHTML = '';
  state.items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'ledger-row';

    const time = document.createElement('span');
    time.className = 'ledger-time';
    time.dataset.role = 'start-time';

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'ledger-name';
    name.value = item.name;
    name.setAttribute('aria-label', 'Step name');
    name.addEventListener('input', () => {
      state.items[index].name = name.value;
      saveState();
    });

    const minutes = document.createElement('input');
    minutes.type = 'number';
    minutes.className = 'ledger-minutes';
    minutes.min = '0';
    minutes.value = item.minutes;
    minutes.setAttribute('aria-label', 'Minutes');
    minutes.addEventListener('input', () => {
      state.items[index].minutes = Number(minutes.value) || 0;
      saveState();
      recalculate();
    });

    const unit = document.createElement('span');
    unit.className = 'ledger-unit';
    unit.textContent = 'min';

    const remove = document.createElement('button');
    remove.className = 'ledger-remove';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.addEventListener('click', () => {
      state.items.splice(index, 1);
      saveState();
      renderLedger();
      recalculate();
    });

    li.append(time, name, minutes, unit, remove);
    ledgerList.appendChild(li);
  });
}

// ---------- Calculation ----------
function parseTimeToNextDate(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDayLabel(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return 'today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  return isTomorrow ? 'tomorrow' : date.toLocaleDateString([], { weekday: 'long' });
}

function recalculate() {
  if (!jobStartInput.value) {
    wakeTimeDisplay.textContent = '--:--';
    wakeMeta.textContent = 'Fill in your morning below to see your wake time';
    leaveByRow.textContent = '';
    return;
  }

  const arrivalDate = parseTimeToNextDate(jobStartInput.value);
  const driveMinutes = Number(driveInput.value) || 0;

  leaveDate = new Date(arrivalDate.getTime() - driveMinutes * 60000);

  // Walk backward through routine items in reverse order (last step finishes right before leaving)
  let cursor = new Date(leaveDate.getTime());
  const rows = ledgerList.querySelectorAll('.ledger-row');
  for (let i = state.items.length - 1; i >= 0; i--) {
    cursor = new Date(cursor.getTime() - state.items[i].minutes * 60000);
    const timeSpan = rows[i].querySelector('[data-role="start-time"]');
    if (timeSpan) timeSpan.textContent = formatTime(cursor);
  }

  wakeDate = cursor;

  wakeTimeDisplay.textContent = formatTime(wakeDate);
  wakeMeta.textContent = `${formatDayLabel(wakeDate)} — to arrive by ${formatTime(arrivalDate)} ${formatDayLabel(arrivalDate)}`;
  leaveByRow.innerHTML = `Leave home by <strong>${formatTime(leaveDate)}</strong>`;

  // If currently armed, re-schedule against the freshly computed wake time
  if (armed) {
    scheduleAlarm(wakeDate);
  }
}

// ---------- Alarm arming ----------
function arm() {
  if (!wakeDate) return;
  const msUntilWake = wakeDate.getTime() - Date.now();
  if (msUntilWake <= 0) {
    wakeMeta.textContent = 'That wake time has already passed — adjust your inputs above.';
    return;
  }
  // Prime audio on a user gesture so it can play later without another click
  ensureAudioContext();

  scheduleAlarm(wakeDate);
  armed = true;
  armBtn.textContent = 'Disarm alarm';
  startCountdown();
}

function disarm() {
  armed = false;
  armBtn.textContent = 'Arm alarm';
  clearTimeout(alarmTimeoutId);
  clearInterval(countdownIntervalId);
  countdownEl.textContent = '';
}

function scheduleAlarm(targetDate) {
  clearTimeout(alarmTimeoutId);
  const ms = targetDate.getTime() - Date.now();
  alarmTimeoutId = setTimeout(triggerAlarm, Math.max(ms, 0));
  startCountdown();
}

function startCountdown() {
  clearInterval(countdownIntervalId);
  countdownIntervalId = setInterval(() => {
    if (!wakeDate) return;
    const msLeft = wakeDate.getTime() - Date.now();
    if (msLeft <= 0) {
      countdownEl.textContent = 'Waking you now…';
      return;
    }
    const totalSeconds = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    countdownEl.textContent = `wakes in ${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s)}`;
  }, 1000);
}

// ---------- Alarm sound (Web Audio API — no external files needed) ----------
function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playAlarmSound() {
  ensureAudioContext();
  stopAlarmSound();

  oscillatorNode = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  oscillatorNode.type = 'square';
  oscillatorNode.frequency.value = 880;
  gainNode.gain.value = 0.0001;

  oscillatorNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillatorNode.start();

  // Pulse the volume to create a beeping pattern rather than a flat tone
  const now = audioCtx.currentTime;
  for (let i = 0; i < 200; i++) {
    const t = now + i * 0.6;
    gainNode.gain.setValueAtTime(0.25, t);
    gainNode.gain.setValueAtTime(0.0001, t + 0.3);
  }
}

function stopAlarmSound() {
  if (oscillatorNode) {
    try { oscillatorNode.stop(); } catch {}
    oscillatorNode.disconnect();
    oscillatorNode = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
}

function triggerAlarm() {
  playAlarmSound();
  alarmPanel.hidden = false;
  clearInterval(countdownIntervalId);
  countdownEl.textContent = 'Wake up!';

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Wake up!', { body: 'Time to start your morning.' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}
