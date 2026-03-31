/**
 * One Minute Speaking Trainer
 * A static, no-backend speaking practice app.
 * ─────────────────────────────────────────────
 * Sections:
 *  1. Constants & State
 *  2. LocalStorage helpers
 *  3. Topic data & filtering
 *  4. Speaking structure map
 *  5. Timer engine
 *  6. DOM rendering
 *  7. Button / state logic
 *  8. Event binding
 *  9. Init
 */

/* ══════════════════════════════════════════════════════════════
   1. CONSTANTS & STATE
══════════════════════════════════════════════════════════════ */

const STATES = { IDLE: 'idle', READY: 'topic_ready', PREP: 'prep', SPEAKING: 'speaking', FINISHED: 'finished' };
const HISTORY_MAX = 10;
const TOPICS_FILE = 'topics.json';

/** Central application state – mutated in place */
const state = {
  appState:      STATES.IDLE,
  topics:        [],
  currentTopic:  null,
  recentIds:     [],
  sessionCount:  0,

  // Prefs (persisted)
  difficulty:    'medium',
  topicType:     'all',
  prepDuration:  45,
  speakDuration: 60,
  autoStart:     false,

  // Timer internals
  timerInterval:    null,
  timerRemaining:   0,
  timerTotal:       0,
};

/* ══════════════════════════════════════════════════════════════
   2. LOCALSTORAGE HELPERS
══════════════════════════════════════════════════════════════ */

const LS_KEY = 'speakingTrainer_v1';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.difficulty    && ['easy','medium','hard'].includes(saved.difficulty))   state.difficulty    = saved.difficulty;
    if (saved.topicType     && ['all','opinion','description','story','comparison','buzzword'].includes(saved.topicType)) state.topicType = saved.topicType;
    if (saved.prepDuration  && [30,45,60].includes(Number(saved.prepDuration)))       state.prepDuration  = Number(saved.prepDuration);
    if (saved.speakDuration && [60,90,120].includes(Number(saved.speakDuration)))     state.speakDuration = Number(saved.speakDuration);
    if (typeof saved.autoStart === 'boolean')                                         state.autoStart     = saved.autoStart;
    if (Array.isArray(saved.recentIds))                                               state.recentIds     = saved.recentIds.slice(0, HISTORY_MAX);
    if (typeof saved.sessionCount === 'number')                                       state.sessionCount  = saved.sessionCount;
  } catch (e) {
    console.warn('[SpeakingTrainer] Could not load preferences:', e);
  }
}

function savePrefs() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      difficulty:    state.difficulty,
      topicType:     state.topicType,
      prepDuration:  state.prepDuration,
      speakDuration: state.speakDuration,
      autoStart:     state.autoStart,
      recentIds:     state.recentIds,
      sessionCount:  state.sessionCount,
    }));
  } catch (e) {
    console.warn('[SpeakingTrainer] Could not save preferences:', e);
  }
}

/* ══════════════════════════════════════════════════════════════
   3. TOPIC DATA & FILTERING
══════════════════════════════════════════════════════════════ */

async function loadTopics() {
  try {
    const res  = await fetch(TOPICS_FILE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw  = await res.json();
    state.topics = raw.filter(validateTopic);
    console.info(`[SpeakingTrainer] Loaded ${state.topics.length} valid topics.`);
  } catch (err) {
    console.error('[SpeakingTrainer] Failed to load topics.json:', err);
    showError('Could not load topics. Make sure <code>topics.json</code> is in the same folder and you are running via a local server.');
    state.topics = [];
  }
}

function validateTopic(t) {
  const ok =
    typeof t.id   === 'number'   &&
    typeof t.text === 'string'   && t.text.trim().length > 0 &&
    ['easy','medium','hard'].includes(t.difficulty) &&
    ['opinion','description','story','comparison','buzzword'].includes(t.type);
  if (!ok) console.warn('[SpeakingTrainer] Skipping invalid topic:', t);
  return ok;
}

function getFilteredTopics() {
  return state.topics.filter(t => {
    const diffOk = t.difficulty === state.difficulty;
    const typeOk = state.topicType === 'all' || t.type === state.topicType;
    return diffOk && typeOk;
  });
}

function pickRandomTopic() {
  const pool = getFilteredTopics();
  if (pool.length === 0) return null;

  // Prefer topics not in recent history
  const fresh = pool.filter(t => !state.recentIds.includes(t.id));
  const candidates = fresh.length > 0 ? fresh : pool;   // graceful fallback
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  // Add to history
  state.recentIds.push(chosen.id);
  if (state.recentIds.length > HISTORY_MAX) state.recentIds.shift();

  return chosen;
}

/* ══════════════════════════════════════════════════════════════
   4. SPEAKING STRUCTURE MAP
══════════════════════════════════════════════════════════════ */

const STRUCTURE_MAP = {
  opinion: [
    'State your opinion clearly',
    'Give one main reason',
    'Add an example or consequence',
  ],
  description: [
    'Say what it is',
    'Explain why it matters',
    'Add one concrete detail',
  ],
  story: [
    'Describe the situation',
    'Explain what happened',
    'End with the result or lesson',
  ],
  comparison: [
    'Introduce both options',
    'Explain the key difference',
    'Say which you prefer and why',
  ],
  buzzword: [
    'Find associations',
    'Choose your focus',
    'Plan your answer',
  ],
};

const PREP_TIPS = {
  opinion: 'Think of 3 keywords. Choose one clear opinion. Do not write full sentences.',
  description: 'Think of 3 keywords. Choose one specific example. Do not write full sentences.',
  comparison: 'Think of 3 keywords. Choose the key difference. Do not write full sentences.',
  story: 'Think of 3 keywords. Choose one specific event. Do not write full sentences.',
  buzzword: 'Think of 3 associations. Pick one angle. Plan 3 short points.',
};

/* ══════════════════════════════════════════════════════════════
   5. TIMER ENGINE
══════════════════════════════════════════════════════════════ */

function startTimer(seconds, onTick, onComplete) {
  clearTimer();
  state.timerTotal     = seconds;
  state.timerRemaining = seconds;
  onTick(seconds, seconds);   // immediate first paint

  state.timerInterval = setInterval(() => {
    state.timerRemaining -= 1;
    onTick(state.timerRemaining, state.timerTotal);
    if (state.timerRemaining <= 0) {
      clearTimer();
      onComplete();
    }
  }, 1000);
}

function clearTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function formatTime(sec) {
  const m = Math.floor(Math.abs(sec) / 60).toString().padStart(2, '0');
  const s = (Math.abs(sec) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ══════════════════════════════════════════════════════════════
   6. DOM RENDERING
══════════════════════════════════════════════════════════════ */

// ── Element references (populated after DOMContentLoaded)
const el = {};

function cacheElements() {
  el.topicCard       = document.getElementById('topicCard');
  el.topicMeta       = document.getElementById('topicMeta');
  el.topicText       = document.getElementById('topicText');
  el.topicEmpty      = document.getElementById('topicEmpty');
  el.structureBlock  = document.getElementById('structureBlock');
  el.structureSteps  = document.getElementById('structureSteps');
  el.prepTipBlock    = document.getElementById('prepTipBlock');
  el.prepTipText     = document.getElementById('prepTipText');

  el.timerArea       = document.getElementById('timerArea');
  el.timerDisplay    = document.getElementById('timerDisplay');
  el.timerModeLabel  = document.getElementById('timerModeLabel');
  el.timerProgress   = document.getElementById('timerProgress');

  el.selectDiff      = document.getElementById('selectDiff');
  el.selectType      = document.getElementById('selectType');
  el.selectPrep      = document.getElementById('selectPrep');
  el.selectSpeak     = document.getElementById('selectSpeak');
  el.toggleAutoStart = document.getElementById('toggleAutoStart');

  el.btnNewTopic     = document.getElementById('btnNewTopic');
  el.btnStartPrep    = document.getElementById('btnStartPrep');
  el.btnStartSpeak   = document.getElementById('btnStartSpeak');
  el.btnRepeat       = document.getElementById('btnRepeat');
  el.btnReset        = document.getElementById('btnReset');
  el.repeatHint      = document.getElementById('repeatHint');
  el.reflectionBox   = document.getElementById('reflectionBox');

  el.sessionCounter  = document.getElementById('sessionCounter');
  el.msgBox          = document.getElementById('msgBox');
}

function applyPrefsToDOM() {
  el.selectDiff.value  = state.difficulty;
  el.selectType.value  = state.topicType;
  el.selectPrep.value  = String(state.prepDuration);
  el.selectSpeak.value = String(state.speakDuration);
  el.toggleAutoStart.checked = state.autoStart;
}

function renderTopic() {
  const t = state.currentTopic;
  if (!t) {
    el.topicCard.classList.remove('has-topic');
    el.topicMeta.innerHTML     = '';
    el.topicText.textContent   = '';
    el.topicEmpty.style.display = 'flex';
    el.structureBlock.style.display = 'none';
    el.prepTipBlock.style.display = 'none';
    el.prepTipText.textContent = '';
    return;
  }

  el.topicEmpty.style.display = 'none';
  el.topicCard.classList.add('has-topic');

  el.topicMeta.innerHTML =
    `<span class="badge badge-difficulty-${t.difficulty}">${t.difficulty}</span>` +
    `<span class="badge badge-type">${t.type}</span>`;

  el.topicText.textContent = t.text;
  renderStructure(t.type);
  renderPrepTip(t.type);
}

function renderStructure(type) {
  const steps = STRUCTURE_MAP[type];
  if (!steps) { el.structureBlock.style.display = 'none'; return; }

  el.structureSteps.innerHTML = steps
    .map((s, i) => `<li><span class="step-num">0${i+1}</span><span>${s}</span></li>`)
    .join('');
  el.structureBlock.style.display = 'block';
}

function renderPrepTip(type) {
  const tip = PREP_TIPS[type];
  if (!tip) {
    el.prepTipBlock.style.display = 'none';
    el.prepTipText.textContent = '';
    return;
  }
  el.prepTipText.textContent = tip;
  el.prepTipBlock.style.display = 'block';
}

function renderTimerArea(remaining, total) {
  el.timerDisplay.querySelector('.timer-value').textContent = formatTime(remaining);
  const pct = total > 0 ? (remaining / total) * 100 : 100;
  el.timerProgress.style.width = `${pct}%`;
}

function renderState() {
  const s = state.appState;

  // Timer area classes
  el.timerArea.className = 'timer-area state-' + (s === STATES.IDLE || s === STATES.READY ? 'idle' : s);

  // Topic card accent
  el.topicCard.className = 'topic-card' +
    (state.currentTopic ? ' has-topic' : '') +
    (s === STATES.PREP     ? ' state-prep' : '') +
    (s === STATES.SPEAKING ? ' state-speaking' : '') +
    (s === STATES.FINISHED ? ' state-finished' : '');

  // Mode label
  const LABELS = {
    [STATES.IDLE]:     '',
    [STATES.READY]:    'ready',
    [STATES.PREP]:     'preparing…',
    [STATES.SPEAKING]: 'speaking',
    [STATES.FINISHED]: 'done ✓',
  };
  el.timerModeLabel.textContent = LABELS[s] ?? '';

  // Timer display colour already handled via CSS class on timer-area

  // Reset timer display when returning to idle/ready
  if (s === STATES.IDLE || s === STATES.READY) {
    el.timerDisplay.querySelector('.timer-value').textContent = formatTime(state.prepDuration);
    el.timerProgress.style.width = '100%';
  }

  // Button states
  const noTopic = !state.currentTopic;
  const isFinished = s === STATES.FINISHED;

  el.btnStartPrep.disabled  = noTopic || s === STATES.PREP || s === STATES.SPEAKING;
  el.btnStartSpeak.disabled = noTopic || s === STATES.SPEAKING || s === STATES.PREP;
  el.btnRepeat.disabled     = noTopic || s === STATES.PREP || s === STATES.SPEAKING;
  el.btnReset.disabled      = s === STATES.IDLE && !state.currentTopic;
  el.btnRepeat.innerHTML    = `<span class="btn-icon" aria-hidden="true">↺</span> ${isFinished ? 'Repeat topic (improve)' : 'Repeat topic'}`;

  // Show Start Speaking only if not auto-starting
  const showStartSpeak = !state.autoStart;
  el.btnStartSpeak.style.display = showStartSpeak ? '' : 'none';

  // Lightweight guidance: emphasize second attempt and finished reflection
  el.repeatHint.style.display = noTopic ? 'none' : '';
  el.reflectionBox.style.display = isFinished ? '' : 'none';

  // Session counter
  el.sessionCounter.textContent = `${state.sessionCount} session${state.sessionCount !== 1 ? 's' : ''}`;
}

function showError(html) {
  el.msgBox.innerHTML    = html;
  el.msgBox.className    = 'message-box message-error';
  el.msgBox.style.display = 'block';
}

function showInfo(html) {
  el.msgBox.innerHTML    = html;
  el.msgBox.className    = 'message-box message-info';
  el.msgBox.style.display = 'block';
}

function hideMessage() {
  el.msgBox.style.display = 'none';
  el.msgBox.innerHTML    = '';
}

/* ══════════════════════════════════════════════════════════════
   7. BUTTON / STATE LOGIC
══════════════════════════════════════════════════════════════ */

function actionNewTopic() {
  clearTimer();
  hideMessage();
  const t = pickRandomTopic();
  if (!t) {
    showInfo('No topics match the current filters. Try a different difficulty or type.');
    state.currentTopic = null;
    state.appState     = STATES.IDLE;
    renderTopic();
    renderState();
    savePrefs();
    return;
  }
  state.currentTopic = t;
  state.appState     = STATES.READY;
  renderTopic();
  renderState();
  savePrefs();
}

function actionRepeat() {
  if (!state.currentTopic) return;
  clearTimer();
  state.appState = STATES.READY;
  renderState();
}

function actionStartPrep() {
  if (!state.currentTopic) return;
  clearTimer();
  state.appState = STATES.PREP;
  renderState();

  startTimer(
    state.prepDuration,
    (remaining, total) => renderTimerArea(remaining, total),
    () => {
      // Prep finished
      if (state.autoStart) {
        actionStartSpeaking();
      } else {
        state.appState = STATES.READY;
        renderState();
        // Nudge user
        el.timerModeLabel.textContent = 'prep done — go!';
      }
    }
  );
}

function actionStartSpeaking() {
  if (!state.currentTopic) return;
  clearTimer();
  state.appState = STATES.SPEAKING;
  renderState();

  startTimer(
    state.speakDuration,
    (remaining, total) => renderTimerArea(remaining, total),
    () => {
      state.appState     = STATES.FINISHED;
      state.sessionCount += 1;
      renderState();
      savePrefs();
      playEndSound();
    }
  );
}

function actionReset() {
  clearTimer();
  state.appState = state.currentTopic ? STATES.READY : STATES.IDLE;
  renderState();
}

function playEndSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [440, 550, 660];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.04);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch (_) { /* Audio not available */ }
}

/* ── "Next step" via Space ─ */
function actionSpaceKey() {
  const s = state.appState;
  if (s === STATES.IDLE)     { actionNewTopic();      return; }
  if (s === STATES.READY)    { actionStartPrep();     return; }
  if (s === STATES.PREP)     { /* let it run */       return; }
  if (s === STATES.SPEAKING) { /* let it run */       return; }
  if (s === STATES.FINISHED) { actionRepeat();        return; }
}

/* ══════════════════════════════════════════════════════════════
   8. EVENT BINDING
══════════════════════════════════════════════════════════════ */

function bindEvents() {
  // Controls
  el.selectDiff.addEventListener('change', () => {
    state.difficulty = el.selectDiff.value;
    savePrefs();
  });

  el.selectType.addEventListener('change', () => {
    state.topicType = el.selectType.value;
    savePrefs();
  });

  el.selectPrep.addEventListener('change', () => {
    state.prepDuration = Number(el.selectPrep.value);
    if (state.appState !== STATES.PREP) renderState();  // refresh display
    savePrefs();
  });

  el.selectSpeak.addEventListener('change', () => {
    state.speakDuration = Number(el.selectSpeak.value);
    savePrefs();
  });

  el.toggleAutoStart.addEventListener('change', () => {
    state.autoStart = el.toggleAutoStart.checked;
    renderState();
    savePrefs();
  });

  // Action buttons
  el.btnNewTopic.addEventListener('click',   actionNewTopic);
  el.btnStartPrep.addEventListener('click',  actionStartPrep);
  el.btnStartSpeak.addEventListener('click', actionStartSpeaking);
  el.btnRepeat.addEventListener('click',     actionRepeat);
  el.btnReset.addEventListener('click',      actionReset);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Ignore when focused on a select / input
    if (['SELECT', 'INPUT'].includes(document.activeElement.tagName)) return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        actionSpaceKey();
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        actionNewTopic();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        actionRepeat();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        if (state.appState === STATES.READY || state.appState === STATES.FINISHED) actionStartPrep();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        if (!state.autoStart && state.appState !== STATES.SPEAKING) actionStartSpeaking();
        break;
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   9. INIT
══════════════════════════════════════════════════════════════ */

async function init() {
  cacheElements();
  loadPrefs();
  applyPrefsToDOM();
  renderTopic();
  renderState();
  bindEvents();

  await loadTopics();

  // Ready
  if (state.topics.length === 0) {
    showError('No valid topics found in <code>topics.json</code>.');
  }
}

document.addEventListener('DOMContentLoaded', init);
