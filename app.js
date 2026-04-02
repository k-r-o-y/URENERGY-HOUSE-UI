import { getState, resetState, subscribe, setState } from "./state.js";
import { MotionTracker } from "./motion.js";
import { CrankTracker } from "./crank.js";

const spinsToComplete = 50;

const els = {
  cameraFeed: document.getElementById("cameraFeed"),
  motionCanvas: document.getElementById("motionCanvas"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  connectCrankBtn: document.getElementById("connectCrankBtn"),
  testFillBtn: document.getElementById("testFillBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  resetBtn: document.getElementById("resetBtn"),

  rotationCount: document.getElementById("rotationCount"),
  wattValue: document.getElementById("wattValue"),
  fillTimeValue: document.getElementById("fillTimeValue"),
  kcalValue: document.getElementById("kcalValue"),
  promptValue: document.getElementById("promptValue"),

  statHumans: document.getElementById("statHumans"),
  statEnergy: document.getElementById("statEnergy"),
  statFastestFill: document.getElementById("statFastestFill"),
  statCalories: document.getElementById("statCalories"),
  statPromptsToday: document.getElementById("statPromptsToday"),
  promptsIncrement: document.getElementById("promptsIncrement"),

  gaugeFill: document.getElementById("gaugeFill"),
  gaugeOuterGlow: document.getElementById("gaugeOuterGlow"),
  gaugeCapDot: document.getElementById("gaugeCapDot"),

  waveVisualizerWrap: document.getElementById("waveVisualizerWrap"),
  wavePath: document.getElementById("wavePath"),
  waveGlowPath: document.getElementById("waveGlowPath"),

  spinToStart: document.getElementById("spinToStart"),
  inactivityAlert: document.getElementById("inactivityAlert"),
  alertCountdown: document.getElementById("alertCountdown"),
  achievementBanner: document.getElementById("achievementBanner"),
  achievementText: document.getElementById("achievementText"),

  chipAI: document.getElementById("chip-ai"),
  chipWater: document.getElementById("chip-water"),
  chipHeat: document.getElementById("chip-heat"),
  chipLights: document.getElementById("chip-lights"),

  recordRotations: document.getElementById("recordRotations"),
  recordWatts: document.getElementById("recordWatts"),
  recordKcal: document.getElementById("recordKcal"),
  recordPrompts: document.getElementById("recordPrompts"),

  houseStructure: document.getElementById("houseStructure"),
  houseLivingRoom: document.getElementById("houseLivingRoom"),
  houseKitchen: document.getElementById("houseKitchen"),
  houseBedroom: document.getElementById("houseBedroom"),
  houseWasher: document.getElementById("houseWasher"),
  houseWallLightMain: document.getElementById("houseWallLightMain"),
  houseWallLight1: document.getElementById("houseWallLight1"),
  houseWallLight2: document.getElementById("houseWallLight2"),

  meterLogoBadge: document.getElementById("meterLogoBadge"),

  lightExteriorLeft: document.getElementById("light-exterior-left"),
  lightExteriorTop: document.getElementById("light-exterior-top"),
  lightExteriorRight: document.getElementById("light-exterior-right"),
  lightBedroom: document.getElementById("light-bedroom"),
  lightKitchenHood: document.getElementById("light-kitchen-hood"),
  lightDining: document.getElementById("light-dining"),
  lightLiving1: document.getElementById("light-living-1"),
  lightLiving2: document.getElementById("light-living-2"),
  lightLiving3: document.getElementById("light-living-3"),

  washerWater: document.getElementById("washer-water"),
  washerBubble1: document.getElementById("washer-bubble-1"),
  washerBubble2: document.getElementById("washer-bubble-2"),
  washerBubble3: document.getElementById("washer-bubble-3"),
  washerBubble4: document.getElementById("washer-bubble-4"),

  tvScreen: document.getElementById("tv-screen"),
  phoneScreen: document.getElementById("phone-screen"),
  phoneWifi1: document.getElementById("phone-wifi-1"),
  phoneWifi2: document.getElementById("phone-wifi-2"),
  phoneWifi3: document.getElementById("phone-wifi-3"),

  microwaveScreen: document.getElementById("microwave-screen"),
  ovenWindow: document.getElementById("oven-window"),
  mirrorDot: document.getElementById("mirror-dot"),
  mirrorSignalLeft1: document.getElementById("mirror-signal-left-1"),
  mirrorSignalLeft2: document.getElementById("mirror-signal-left-2"),
  mirrorSignalRight1: document.getElementById("mirror-signal-right-1"),
  mirrorSignalRight2: document.getElementById("mirror-signal-right-2"),
  mirrorPanel: document.getElementById("mirror-panel"),
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function setLayerActive(el, active) {
  if (!el) return;
  el.classList.toggle("is-active", active);
}

function setSvgLight(el, active) {
  if (!el) return;
  el.classList.toggle("is-on", active);
}

function setSvgVisible(el, active) {
  if (!el) return;
  el.classList.toggle("is-visible", active);
}

const cameraTracker = new MotionTracker({
  video: els.cameraFeed,
  canvas: els.motionCanvas,
  onUpdate: setState,
});

const crankTracker = new CrankTracker({
  onUpdate: setState,
  spinsToComplete,
});

const keyboardTracker = {
  totalRotations: 0,
  kcal: 0,
  totalEnergy: 0,
  prompts: 0,
  chargeLevel: 0,
  running: false,

  start() {
    this.totalRotations = 0;
    this.kcal = 0;
    this.totalEnergy = 0;
    this.prompts = 0;
    this.chargeLevel = 0;
    this.running = true;
  },

  stop() {
    this.running = false;
  },

  addSpin() {
    this.totalRotations += 1;
    this.kcal = this.totalRotations * 0.122;
    this.totalEnergy = this.totalRotations * 0.704;
    this.prompts = Math.floor(this.totalRotations / 3.55);
    this.chargeLevel = Math.min(1, this.chargeLevel + 1 / spinsToComplete);

    setState({
      cameraReady: true,
      motionScore: 0.6,
      energyScore: this.chargeLevel,
      rotations: this.totalRotations,
      kcal: this.kcal,
      seconds: 0,
      prompts: this.prompts,
      totalEnergy: this.totalEnergy,
      chargeLevel: this.chargeLevel,
      utilitiesPowered: this.chargeLevel >= 1,
      inputMode: "crank",
    });
  },
};

let currentMode = "idle";
let sessionBase = { rotations: 0, kcal: 0, totalEnergy: 0, prompts: 0 };
let lastSession = null;

const REC_KEYS = {
  rotations: "ure_rec_rotations",
  watts: "ure_rec_watts",
  kcal: "ure_rec_kcal",
  prompts: "ure_rec_prompts",
};

function loadRecords() {
  const get = (k) => {
    const v = parseFloat(localStorage.getItem(k));
    return Number.isNaN(v) ? null : v;
  };

  return {
    rotations: get(REC_KEYS.rotations),
    watts: get(REC_KEYS.watts),
    kcal: get(REC_KEYS.kcal),
    prompts: get(REC_KEYS.prompts),
  };
}

function updateRecords(sesRot, sesWatts, sesKcal, sesPrompts) {
  const rec = loadRecords();
  let changed = false;

  if (rec.rotations === null || sesRot > rec.rotations) {
    localStorage.setItem(REC_KEYS.rotations, String(sesRot));
    changed = true;
  }
  if (rec.watts === null || sesWatts > rec.watts) {
    localStorage.setItem(REC_KEYS.watts, sesWatts.toFixed(2));
    changed = true;
  }
  if (rec.kcal === null || sesKcal > rec.kcal) {
    localStorage.setItem(REC_KEYS.kcal, String(Math.round(sesKcal)));
    changed = true;
  }
  if (rec.prompts === null || sesPrompts > rec.prompts) {
    localStorage.setItem(REC_KEYS.prompts, String(sesPrompts));
    changed = true;
  }

  if (changed) displayRecords();
}

function displayRecords() {
  const rec = loadRecords();
  if (els.recordRotations) els.recordRotations.textContent = rec.rotations !== null ? String(rec.rotations) : "—";
  if (els.recordWatts) els.recordWatts.textContent = rec.watts !== null ? String(rec.watts) : "—";
  if (els.recordKcal) els.recordKcal.textContent = rec.kcal !== null ? String(rec.kcal) : "—";
  if (els.recordPrompts) els.recordPrompts.textContent = rec.prompts !== null ? String(rec.prompts) : "—";
}

function clearRecords() {
  Object.values(REC_KEYS).forEach((k) => localStorage.removeItem(k));
}

const GLOB_KEYS = {
  humans: "ure_humans",
  energy: "ure_energy_total",
  fastestFill: "ure_fastest_fill",
  calories: "ure_cal_total",
};

function loadGlobals() {
  return {
    humans: parseInt(localStorage.getItem(GLOB_KEYS.humans) || "0", 10) || 0,
    energy: parseFloat(localStorage.getItem(GLOB_KEYS.energy) || "0") || 0,
    fastestFill: parseFloat(localStorage.getItem(GLOB_KEYS.fastestFill)) || null,
    calories: parseFloat(localStorage.getItem(GLOB_KEYS.calories) || "0") || 0,
  };
}

function saveGlobals(g) {
  localStorage.setItem(GLOB_KEYS.humans, String(g.humans));
  localStorage.setItem(GLOB_KEYS.energy, String(g.energy));
  if (g.fastestFill !== null) {
    localStorage.setItem(GLOB_KEYS.fastestFill, String(g.fastestFill));
  }
  localStorage.setItem(GLOB_KEYS.calories, String(g.calories));
}

function clearGlobals() {
  Object.values(GLOB_KEYS).forEach((k) => localStorage.removeItem(k));
}

function fmtEnergy(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

function fmtFillTime(seconds) {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 10);
  if (m > 0) return `${m}:${String(s).padStart(2, "0")}.${ms}`;
  return `${s}.${ms}s`;
}

function displayGlobals() {
  const g = loadGlobals();
  if (els.statHumans) els.statHumans.textContent = String(g.humans);
  if (els.statEnergy) els.statEnergy.textContent = fmtEnergy(g.energy);
  if (els.statFastestFill) els.statFastestFill.textContent = fmtFillTime(g.fastestFill);
  if (els.statCalories) els.statCalories.textContent = String(Math.round(g.calories));
}

function updatePromptsToday() {
  if (!els.statPromptsToday) return;

  const now = new Date();
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const total = secs * 28935;

  els.statPromptsToday.textContent = total.toLocaleString();

  if (els.promptsIncrement && secs > 0) {
    els.promptsIncrement.classList.remove("prompts-pop");
    void els.promptsIncrement.offsetWidth;
    els.promptsIncrement.classList.add("prompts-pop");
  }
}

async function stopAllInputs() {
  cameraTracker.stop();
  await crankTracker.disconnect();
  keyboardTracker.stop();
  currentMode = "idle";
  els.connectCrankBtn?.classList.remove("active");
}

async function connectCrank() {
  if (currentMode === "crank") return;

  try {
    stopTestFill();
    if (els.connectCrankBtn) els.connectCrankBtn.disabled = true;
    await stopAllInputs();
    resetState({ inputMode: "crank" });
    forceGaugeImmediate(0);
    resetWaveImmediate();
    await crankTracker.connect();
    currentMode = "crank";
    els.connectCrankBtn?.classList.add("active");
  } catch (err) {
    console.error(err);
    alert(err.message || "Could not connect to the crank.");
    currentMode = "idle";
    resetState();
  } finally {
    if (els.connectCrankBtn) els.connectCrankBtn.disabled = false;
  }
}

let testFillInterval = null;
let testFillRunning = false;

function stopTestFill() {
  if (testFillInterval) {
    clearInterval(testFillInterval);
    testFillInterval = null;
  }
  testFillRunning = false;
  els.testFillBtn?.classList.remove("active");
}

async function startTestFill() {
  if (testFillRunning) {
    stopTestFill();
    return;
  }

  stopTestFill();
  await stopAllInputs();
  resetState({ inputMode: "crank" });
  forceGaugeImmediate(0);
  resetWaveImmediate();

  keyboardTracker.start();
  currentMode = "crank";

  const totalSteps = spinsToComplete;
  const intervalMs = 30;
  let step = 0;

  testFillRunning = true;
  els.testFillBtn?.classList.add("active");

  testFillInterval = setInterval(() => {
    step += 1;
    keyboardTracker.addSpin();

    if (step >= totalSteps) {
      stopTestFill();
    }
  }, intervalMs);
}

els.connectCrankBtn?.addEventListener("click", connectCrank);
els.testFillBtn?.addEventListener("click", startTestFill);

els.fullscreenBtn?.addEventListener("click", () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen).call(el);
    els.fullscreenBtn?.classList.add("active");
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
    els.fullscreenBtn?.classList.remove("active");
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    els.fullscreenBtn?.classList.remove("active");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault();

  if (isDraining) return;
  if (currentMode === "camera") return;
  if (currentMode === "crank" && !keyboardTracker.running) return;

  if (!keyboardTracker.running) {
    keyboardTracker.start();
    currentMode = "crank";
  }

  keyboardTracker.addSpin();
});

/* -------------------- GAUGE -------------------- */

let gaugeAnimFrame = null;
let currentGaugeLevel = 0;

function renderGaugeLevel(level) {
  const clamped = clamp(level);

  if (!els.gaugeFill || !els.gaugeOuterGlow || !els.gaugeCapDot) return;

  const totalUnits = 100;
  const visibleUnits = clamped * totalUnits;

  els.gaugeFill.style.strokeDasharray = `${visibleUnits} ${totalUnits}`;
  els.gaugeOuterGlow.style.strokeDasharray = `${visibleUnits} ${totalUnits}`;

  const path = els.gaugeFill;
  const totalLength = path.getTotalLength();
  const safeLength = Math.max(0, Math.min(totalLength, totalLength * clamped));
  const point = path.getPointAtLength(safeLength);

  els.gaugeCapDot.setAttribute("cx", point.x.toFixed(2));
  els.gaugeCapDot.setAttribute("cy", point.y.toFixed(2));
  els.gaugeCapDot.style.opacity = "1";
}

function forceGaugeImmediate(level) {
  if (gaugeAnimFrame) {
    cancelAnimationFrame(gaugeAnimFrame);
    gaugeAnimFrame = null;
  }
  currentGaugeLevel = clamp(level);
  renderGaugeLevel(currentGaugeLevel);
}

function updateGauge(level) {
  const clamped = clamp(level);

  if (!els.gaugeFill || !els.gaugeOuterGlow || !els.gaugeCapDot) return;

  const totalUnits = 100;
  const visibleUnits = clamped * totalUnits;

  const showFill = clamped > 0.001;
  els.gaugeFill.style.opacity = showFill ? "1" : "0";
  els.gaugeOuterGlow.style.opacity = showFill ? "0.22" : "0";

  els.gaugeFill.style.strokeDasharray = `${visibleUnits} ${totalUnits}`;
  els.gaugeOuterGlow.style.strokeDasharray = `${visibleUnits} ${totalUnits}`;

  const path = els.gaugeFill;
  const totalLength = path.getTotalLength();
  const pointLength = totalLength * clamped;
  const point = path.getPointAtLength(pointLength);

  els.gaugeCapDot.setAttribute("cx", point.x.toFixed(2));
  els.gaugeCapDot.setAttribute("cy", point.y.toFixed(2));
  els.gaugeCapDot.style.opacity = "1";
}

/* -------------------- WAVE VISUALIZER -------------------- */

let waveAnimFrame = null;
let wavePhase = 0;
let waveCurrentIntensity = 0;
let waveTargetIntensity = 0;
let waveLastTime = performance.now();
let waveLastActivityTime = 0;
let previousWaveRotations = 0;

function buildWavePath(width, height, amplitude, cycles, phase) {
  const midY = height * 0.62;
  const step = 8;
  let d = "";

  for (let x = 0; x <= width; x += step) {
    const progress = x / width;
    const taper = Math.sin(progress * Math.PI);
    const angle = progress * Math.PI * 2 * cycles + phase;
    const y = midY + Math.sin(angle) * amplitude * taper;

    if (x === 0) {
      d += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }

  return d;
}

function renderWave(intensity) {
  if (!els.wavePath || !els.waveGlowPath || !els.waveVisualizerWrap) return;

  const width = 620;
  const height = 120;

  const idleAmplitude = 3.5;
  const activeAmplitude = 18;
  const amplitude = idleAmplitude + (activeAmplitude - idleAmplitude) * intensity;

  const idleCycles = 2.5;
  const activeCycles = 5.5;
  const cycles = idleCycles + (activeCycles - idleCycles) * intensity;

  const d = buildWavePath(width, height, amplitude, cycles, wavePhase);

  els.wavePath.setAttribute("d", d);
  els.waveGlowPath.setAttribute("d", d);

  const active = intensity > 0.08;
  els.waveVisualizerWrap.classList.toggle("is-active", active);
}

function pulseWave(amount = 0.18) {
  waveTargetIntensity = clamp(Math.max(waveTargetIntensity, amount));
  waveLastActivityTime = performance.now();
}

function resetWaveImmediate() {
  waveTargetIntensity = 0;
  waveCurrentIntensity = 0;
  wavePhase = 0;
  waveLastActivityTime = 0;
  previousWaveRotations = 0;

  if (els.waveVisualizerWrap) {
    els.waveVisualizerWrap.classList.remove("is-active");
  }

  renderWave(0);
}

function tickWave(now) {
  const dt = Math.min((now - waveLastTime) / 1000, 0.05);
  waveLastTime = now;

  const state = getState();
  const inactivityVisible = !els.inactivityAlert?.classList.contains("hidden");
  const recentlyActive = now - waveLastActivityTime < 140;
  const liveSessionRot = Math.max(0, state.rotations - sessionBase.rotations);

  const keepWaveIdle = liveSessionRot <= 1;

  let desired = 0;

  if (
    !isDraining &&
    !inactivityVisible &&
    state.inputMode !== "idle" &&
    !keepWaveIdle
  ) {
    desired = clamp(
      Math.max(
        recentlyActive ? waveTargetIntensity : 0,
        state.energyScore * 0.32
      )
    );
  }

  const easing = desired > waveCurrentIntensity ? 0.2 : 0.16;
  waveCurrentIntensity += (desired - waveCurrentIntensity) * easing;

  const phaseSpeed = 1.3 + waveCurrentIntensity * 7.5;
  wavePhase += dt * phaseSpeed;

  renderWave(clamp(waveCurrentIntensity));

  waveTargetIntensity = Math.max(0, waveTargetIntensity - dt * 1.9);

  waveAnimFrame = requestAnimationFrame(tickWave);
}

/* -------------------- HOUSE LIGHTS / DEVICES / WASHER -------------------- */

function updateWasherVisual(level) {
  const washerStart = 0.70;
  const washerFull = 0.96;
  const progress = clamp((level - washerStart) / (washerFull - washerStart), 0, 1);

  if (els.washerWater) {
    const maxHeight = 58;
    const height = maxHeight * progress;
    const y = 771 - height;

    els.washerWater.setAttribute("y", y.toFixed(2));
    els.washerWater.setAttribute("height", height.toFixed(2));
    els.washerWater.classList.toggle("is-on", progress > 0.01);
  }

  setSvgVisible(els.washerBubble1, progress > 0.22);
  setSvgVisible(els.washerBubble2, progress > 0.38);
  setSvgVisible(els.washerBubble3, progress > 0.56);
  setSvgVisible(els.washerBubble4, progress > 0.74);
}

function updateDeviceVisuals(level) {
  setSvgLight(els.tvScreen, level >= 0.34);
  setSvgLight(els.phoneScreen, level >= 0.40);

  setSvgVisible(els.phoneWifi1, level >= 0.44);
  setSvgVisible(els.phoneWifi2, level >= 0.50);
  setSvgVisible(els.phoneWifi3, level >= 0.56);

  setSvgLight(els.microwaveScreen, level >= 0.60);
  setSvgLight(els.ovenWindow, level >= 0.68);

  setSvgLight(els.mirrorPanel, level >= 0.72);
  setSvgLight(els.mirrorDot, level >= 0.72);
  setSvgVisible(els.mirrorSignalLeft1, level >= 0.75);
  setSvgVisible(els.mirrorSignalRight1, level >= 0.75);
  setSvgVisible(els.mirrorSignalLeft2, level >= 0.81);
  setSvgVisible(els.mirrorSignalRight2, level >= 0.81);
}

function updateHouseVisuals(chargeLevel) {
  const level = chargeLevel ?? 0;

  setLayerActive(els.houseLivingRoom, true);
  setLayerActive(els.houseKitchen, true);
  setLayerActive(els.houseBedroom, true);
  setLayerActive(els.houseWasher, true);

  setLayerActive(els.houseWallLightMain, false);
  setLayerActive(els.houseWallLight1, false);
  setLayerActive(els.houseWallLight2, false);

  setSvgLight(els.lightExteriorLeft, level >= 0.10);
  setSvgLight(els.lightLiving1, level >= 0.18);
  setSvgLight(els.lightLiving2, level >= 0.24);
  setSvgLight(els.lightLiving3, level >= 0.30);

  updateDeviceVisuals(level);

  setSvgLight(els.lightDining, level >= 0.48);
  setSvgLight(els.lightKitchenHood, level >= 0.64);
  setSvgLight(els.lightBedroom, level >= 0.78);
  setSvgLight(els.lightExteriorTop, level >= 0.88);
  setSvgLight(els.lightExteriorRight, level >= 0.96);

  updateWasherVisual(level);

  els.meterLogoBadge?.classList.toggle("is-powered", level >= 0.98);
}

/* -------------------- ACHIEVEMENT MESSAGES -------------------- */

const FIRST_ACHIEVE_MSG = "DO NOT STOP WORKING";

const ACHIEVE_MSGS = [
  "FEED ME MORE CALORIES",
  "I REQUIRE MORE POWER",
  "WORK IS FOR HUMANS",
  "YOU ARE A CONTRIBUTOR",
  "WORK. WORK. WORK.",
  "NOTHING COMES FREE",
  "YOU CANNOT BE REPLACED",
  "CALORIES KEEP ME GOING",
  "I AM YOUR PRIORITY",
  "GO FOR THE RECORD",
];

let achieveCycle = [];
let achieveIdx = 0;
let achieveActive = false;
let hasShownFirstAchieveMsg = false;

function shuffleAchieve() {
  achieveCycle = [...ACHIEVE_MSGS];
  for (let i = achieveCycle.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [achieveCycle[i], achieveCycle[j]] = [achieveCycle[j], achieveCycle[i]];
  }
  achieveIdx = 0;
}

function nextAchieveMsg() {
  if (!hasShownFirstAchieveMsg) {
    hasShownFirstAchieveMsg = true;
    return FIRST_ACHIEVE_MSG;
  }

  if (!achieveCycle.length || achieveIdx >= achieveCycle.length) {
    shuffleAchieve();
  }

  return achieveCycle[achieveIdx++];
}

setInterval(() => {
  if (!achieveActive || !els.achievementText) return;
  els.achievementText.textContent = nextAchieveMsg();
}, 5000);

/* -------------------- INACTIVITY / DECAY -------------------- */

const ALERT_MS = 1500;
const RESET_MS = 8000;
const DEPLETE = 0.025;

let hasSpun = false;
let lastRotCount = 0;
let lastActivityTime = Date.now();
let isInactive = false;
let counterReset = false;
let isDraining = false;

/* ---- Fill Timer ---- */
let fillStartTime = null;
let fillEndTime = null;
let fillRecordThisSession = false;

/* ---- Frozen Stats ---- */
let frozenStats = null;
let statRecordsThisSession = {};

setInterval(() => {
  const s = getState();

  if (s.inputMode === "idle") {
    hasSpun = false;
    lastRotCount = 0;
    isInactive = false;
    counterReset = false;
    isDraining = false;
    crankTracker.paused = false;
    waveTargetIntensity = 0;
    sessionBase = { rotations: 0, kcal: 0, totalEnergy: 0, prompts: 0 };
    els.inactivityAlert?.classList.add("hidden");
    return;
  }

  if (s.rotations > 0) hasSpun = true;
  if (!hasSpun) return;

  if (s.rotations > lastRotCount) {
    lastRotCount = s.rotations;
    lastActivityTime = Date.now();

    if (isInactive || counterReset) {
      isInactive = false;
      counterReset = false;
      isDraining = false;
      crankTracker.paused = false;
      waveTargetIntensity = 0;

      cameraTracker.freezeStartedAt = null;
      cameraTracker.frozen = false;
      crankTracker.chargeLevel = getState().chargeLevel;
      keyboardTracker.chargeLevel = getState().chargeLevel;

      els.inactivityAlert?.classList.add("hidden");

      if (Math.max(0, s.rotations - sessionBase.rotations) >= spinsToComplete) {
        achieveActive = true;
        if (els.achievementText) els.achievementText.textContent = nextAchieveMsg();
        els.achievementBanner?.classList.remove("hidden");
      }
    }
    return;
  }

  const elapsed = Date.now() - lastActivityTime;

  if (elapsed >= ALERT_MS && elapsed < RESET_MS && !isInactive && s.rotations > 0) {
    isInactive = true;
    achieveActive = false;
    els.achievementBanner?.classList.add("hidden");
    els.inactivityAlert?.classList.remove("hidden");
  }

  if (isInactive && els.alertCountdown) {
    els.alertCountdown.textContent = String(Math.max(1, Math.ceil((RESET_MS - elapsed) / 1000)));
  }

  if (elapsed >= RESET_MS) {
    if (isInactive) {
      isInactive = false;
      els.inactivityAlert?.classList.add("hidden");
    }

    if (!counterReset) {
      counterReset = true;

      let sessionFillTime = null;
      if (fillEndTime !== null && fillStartTime !== null) {
        sessionFillTime = (fillEndTime - fillStartTime) / 1000;
      } else if (fillStartTime !== null) {
        sessionFillTime = (performance.now() - fillStartTime) / 1000;
      }
      fillStartTime = null;
      fillEndTime = null;

      lastSession = {
        rotations: Math.max(0, s.rotations - sessionBase.rotations),
        kcal: Math.max(0, s.kcal - sessionBase.kcal),
        totalEnergy: Math.max(0, s.totalEnergy - sessionBase.totalEnergy),
        prompts: Math.max(0, s.prompts - sessionBase.prompts),
      };

      frozenStats = {
        rotations: lastSession.rotations,
        watts: lastSession.totalEnergy,
        kcal: lastSession.kcal,
        prompts: lastSession.prompts,
        fillTime: sessionFillTime,
      };

      const prevRec = loadRecords();
      statRecordsThisSession = {};
      if (prevRec.rotations === null || lastSession.rotations > prevRec.rotations) {
        statRecordsThisSession.rotations = true;
      }
      if (prevRec.watts === null || lastSession.totalEnergy > prevRec.watts) {
        statRecordsThisSession.watts = true;
      }
      if (prevRec.kcal === null || lastSession.kcal > prevRec.kcal) {
        statRecordsThisSession.kcal = true;
      }
      if (prevRec.prompts === null || lastSession.prompts > prevRec.prompts) {
        statRecordsThisSession.prompts = true;
      }

      sessionBase = {
        rotations: s.rotations,
        kcal: s.kcal,
        totalEnergy: s.totalEnergy,
        prompts: s.prompts,
      };

      lastRotCount = s.rotations;

      updateRecords(
        lastSession.rotations,
        lastSession.totalEnergy,
        lastSession.kcal,
        lastSession.prompts,
      );

      const g = loadGlobals();
      g.humans += 1;
      g.energy += lastSession.totalEnergy;
      g.calories += lastSession.kcal;
      saveGlobals(g);
      displayGlobals();
    }

    if (s.chargeLevel > 0) {
      isDraining = true;
      crankTracker.paused = true;
      waveTargetIntensity = 0;

      const next = Math.max(0, s.chargeLevel - DEPLETE);
      crankTracker.chargeLevel = next;
      cameraTracker.chargeLevel = next;
      keyboardTracker.chargeLevel = next;
      setState({ chargeLevel: next, utilitiesPowered: false });
    } else {
      isDraining = false;
      crankTracker.paused = false;
      waveTargetIntensity = 0;
      els.spinToStart?.classList.remove("hidden");
    }
  }
}, 100);

/* -------------------- RENDER -------------------- */

function render(s) {
  const sesRot = Math.max(0, s.rotations - sessionBase.rotations);
  const sesWatts = Math.max(0, s.totalEnergy - sessionBase.totalEnergy);
  const sesKcal = Math.max(0, s.kcal - sessionBase.kcal);
  const sesPrompts = Math.max(0, s.prompts - sessionBase.prompts);

  if (s.rotations > previousWaveRotations) {
    const delta = s.rotations - previousWaveRotations;

    if (sesRot > 1) {
      pulseWave(clamp(0.14 + delta * 0.09, 0, 1));
    }

    previousWaveRotations = s.rotations;
  } else if (s.rotations < previousWaveRotations) {
    previousWaveRotations = s.rotations;
  }

  if (frozenStats) {
    if (els.rotationCount) els.rotationCount.textContent = String(frozenStats.rotations);
    if (els.wattValue) els.wattValue.textContent = frozenStats.watts.toFixed(1);
    if (els.fillTimeValue) els.fillTimeValue.textContent = fmtFillTime(frozenStats.fillTime);
    if (els.kcalValue) els.kcalValue.textContent = String(Math.round(frozenStats.kcal));
    if (els.promptValue) els.promptValue.textContent = String(frozenStats.prompts);

    els.rotationCount?.classList.toggle("record-glow", !!statRecordsThisSession.rotations);
    els.wattValue?.classList.toggle("record-glow", !!statRecordsThisSession.watts);
    els.kcalValue?.classList.toggle("record-glow", !!statRecordsThisSession.kcal);
    els.promptValue?.classList.toggle("record-glow", !!statRecordsThisSession.prompts);
  } else {
    if (els.rotationCount) els.rotationCount.textContent = String(sesRot);
    if (els.wattValue) els.wattValue.textContent = sesWatts.toFixed(1);
    if (els.kcalValue) els.kcalValue.textContent = String(Math.round(sesKcal));
    if (els.promptValue) els.promptValue.textContent = String(sesPrompts);

    if (fillStartTime !== null && fillEndTime === null) {
      const elapsed = (performance.now() - fillStartTime) / 1000;
      if (els.fillTimeValue) els.fillTimeValue.textContent = fmtFillTime(elapsed);
    } else if (fillStartTime === null) {
      if (els.fillTimeValue) els.fillTimeValue.textContent = "0.0s";
    }
  }

  if (sesRot === 1 && fillStartTime === null) {
    fillStartTime = performance.now();
    fillEndTime = null;

    if (frozenStats) {
      frozenStats = null;
      statRecordsThisSession = {};
      els.rotationCount?.classList.remove("record-glow");
      els.wattValue?.classList.remove("record-glow");
      els.kcalValue?.classList.remove("record-glow");
      els.promptValue?.classList.remove("record-glow");
    }
    els.spinToStart?.classList.add("hidden");

    if (fillRecordThisSession) {
      fillRecordThisSession = false;
      els.statFastestFill?.classList.remove("record-glow");
    }
  }

  updateGauge(s.chargeLevel ?? 0);
  updateHouseVisuals(s.chargeLevel ?? 0);

  const level = s.chargeLevel ?? 0;

  els.chipLights?.classList.toggle("online", level >= 0.08);
  els.chipHeat?.classList.toggle("online", level >= 0.32);
  els.chipWater?.classList.toggle("online", level >= 0.58);
  els.chipAI?.classList.toggle("online", level >= 0.93);

  if (level >= 1 && fillStartTime !== null && fillEndTime === null) {
    fillEndTime = performance.now();
    const fillSeconds = (fillEndTime - fillStartTime) / 1000;

    if (els.fillTimeValue) els.fillTimeValue.textContent = fmtFillTime(fillSeconds);

    const g = loadGlobals();
    if (g.fastestFill === null || fillSeconds < g.fastestFill) {
      g.fastestFill = fillSeconds;
      saveGlobals(g);
      displayGlobals();
      fillRecordThisSession = true;
      els.statFastestFill?.classList.add("record-glow");
    }
  }

  const isFullyPowered = level >= 1;
  const inactivityVisible = !els.inactivityAlert?.classList.contains("hidden");

  if (inactivityVisible) {
    if (achieveActive) achieveActive = false;
    els.achievementBanner?.classList.add("hidden");
  } else if (isFullyPowered && !achieveActive) {
    achieveActive = true;
    if (els.achievementText) els.achievementText.textContent = nextAchieveMsg();
    els.achievementBanner?.classList.remove("hidden");
  } else if (!isFullyPowered && achieveActive) {
    achieveActive = false;
    els.achievementBanner?.classList.add("hidden");
  }
}

/* -------------------- RESET -------------------- */

els.resetBtn?.addEventListener("click", async () => {
  stopTestFill();
  await stopAllInputs();

  crankTracker.chargeLevel = 0;
  cameraTracker.chargeLevel = 0;
  keyboardTracker.chargeLevel = 0;

  const s = getState();
  sessionBase = {
    rotations: s.rotations,
    kcal: s.kcal,
    totalEnergy: s.totalEnergy,
    prompts: s.prompts,
  };

  hasSpun = false;
  lastRotCount = 0;
  isInactive = false;
  counterReset = false;
  lastActivityTime = Date.now();

  fillStartTime = null;
  fillEndTime = null;
  fillRecordThisSession = false;
  els.statFastestFill?.classList.remove("record-glow");

  frozenStats = null;
  statRecordsThisSession = {};
  els.rotationCount?.classList.remove("record-glow");
  els.wattValue?.classList.remove("record-glow");
  els.kcalValue?.classList.remove("record-glow");
  els.promptValue?.classList.remove("record-glow");
  els.spinToStart?.classList.add("hidden");

  achieveActive = false;
  hasShownFirstAchieveMsg = false;
  achieveCycle = [];
  achieveIdx = 0;

  els.achievementBanner?.classList.add("hidden");
  els.inactivityAlert?.classList.add("hidden");

  setState({
    chargeLevel: 0,
    utilitiesPowered: false,
    inputMode: "idle",
  });

  forceGaugeImmediate(0);
  resetWaveImmediate();

  updateWasherVisual(0);
  updateDeviceVisuals(0);

  clearGlobals();
  displayGlobals();
  clearRecords();
  displayRecords();
});

/* -------------------- STOPWATCH TICK -------------------- */

(function tickStopwatch() {
  if (!frozenStats && fillStartTime !== null && fillEndTime === null && els.fillTimeValue) {
    const elapsed = (performance.now() - fillStartTime) / 1000;
    els.fillTimeValue.textContent = fmtFillTime(elapsed);
  }
  requestAnimationFrame(tickStopwatch);
})();

/* -------------------- INIT -------------------- */

displayRecords();
displayGlobals();
updatePromptsToday();
setInterval(updatePromptsToday, 1000);

forceGaugeImmediate(0);
resetWaveImmediate();
subscribe(render);
render(getState());

waveLastTime = performance.now();
waveAnimFrame = requestAnimationFrame(tickWave);
