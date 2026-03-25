import { getState, resetState, subscribe, setState } from "./state.js";
import { MotionTracker } from "./motion.js";
import { CrankTracker } from "./crank.js";

const els = {
  cameraFeed:     document.getElementById("cameraFeed"),
  motionCanvas:   document.getElementById("motionCanvas"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  connectCrankBtn:document.getElementById("connectCrankBtn"),
  fullscreenBtn:  document.getElementById("fullscreenBtn"),

  rotationCount:  document.getElementById("rotationCount"),
  wattValue:      document.getElementById("wattValue"),
  kcalValue:      document.getElementById("kcalValue"),
  promptValue:    document.getElementById("promptValue"),
  globalPrompts:  document.getElementById("globalPrompts"),
  globalEnergy:   document.getElementById("globalEnergy"),
  endpointLabel:  document.getElementById("endpointLabel"),

  gaugeFill:      document.getElementById("gaugeFill"),
  gaugeOuterGlow: document.getElementById("gaugeOuterGlow"),
  gaugeCapDot:    document.getElementById("gaugeCapDot"),
  inactivityAlert:document.getElementById("inactivityAlert"),

  smoke:          document.getElementById("chimneySmoke"),
  lightBedroom:   document.getElementById("utility-light-bedroom"),
  lightBathroom:  document.getElementById("utility-light-bathroom"),
  lightKitchen:   document.getElementById("utility-light-kitchen"),
  waterTank:      document.getElementById("utility-water-tank"),
  radiator:       document.getElementById("utility-radiator"),
  boiler:         document.getElementById("utility-boiler"),
  pump:           document.getElementById("utility-pump"),

  statusLights:   document.getElementById("statusLights"),
  statusWater:    document.getElementById("statusWater"),
  statusHeat:     document.getElementById("statusHeat"),
  statusPower:    document.getElementById("statusPower"),
  statusSmoke:    document.getElementById("statusSmoke"),
};

// ─── Input trackers ────────────────────────────────────────────────────────
const cameraTracker = new MotionTracker({
  video: els.cameraFeed,
  canvas: els.motionCanvas,
  onUpdate: (patch) => setState(patch),
});

const crankTracker = new CrankTracker({
  onUpdate: (patch) => setState(patch),
});

let currentMode = "idle";

async function stopAllInputs() {
  cameraTracker.stop();
  await crankTracker.disconnect();
  currentMode = "idle";
}

async function startCamera() {
  if (currentMode === "camera") return;
  try {
    els.startCameraBtn.disabled = true;
    els.connectCrankBtn.disabled = true;
    await stopAllInputs();
    resetState({ inputMode: "camera" });
    await cameraTracker.start();
    currentMode = "camera";
    els.startCameraBtn.textContent = "Camera Live";
    els.connectCrankBtn.textContent = "Connect Crank";
  } catch (error) {
    console.error("Camera failed to start:", error);
    alert("Could not access the camera.");
    currentMode = "idle";
    resetState();
  } finally {
    els.startCameraBtn.disabled = currentMode === "camera";
    els.connectCrankBtn.disabled = false;
  }
}

async function connectCrank() {
  if (currentMode === "crank") return;
  try {
    els.startCameraBtn.disabled = true;
    els.connectCrankBtn.disabled = true;
    await stopAllInputs();
    resetState({ inputMode: "crank" });
    await crankTracker.connect();
    currentMode = "crank";
    els.connectCrankBtn.textContent = "Crank Connected";
    els.startCameraBtn.textContent = "Start Camera";
  } catch (error) {
    console.error("Crank failed to connect:", error);
    alert(error.message || "Could not connect to the crank.");
    currentMode = "idle";
    resetState();
  } finally {
    els.connectCrankBtn.disabled = currentMode === "crank";
    els.startCameraBtn.disabled = false;
  }
}

els.connectCrankBtn.addEventListener("click", connectCrank);

// ─── Fullscreen ────────────────────────────────────────────────────────────
els.fullscreenBtn.addEventListener("click", () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen).call(el);
    els.fullscreenBtn.classList.add("active");
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
    els.fullscreenBtn.classList.remove("active");
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) els.fullscreenBtn.classList.remove("active");
});

// ─── Gauge update ──────────────────────────────────────────────────────────
// 270° arc on r=45 circle: circumference=283, arc=212, gap=71
const GAUGE_ARC_MAX = 212;

function updateGauge(level) {
  const fill = Math.max(0, Math.min(1, level)) * GAUGE_ARC_MAX;
  const dashVal = `${fill.toFixed(2)} 9999`;
  els.gaugeFill.style.strokeDasharray = dashVal;
  els.gaugeOuterGlow.style.strokeDasharray = dashVal;

  // Show/hide tip dot — position in SVG space accounting for CSS rotate(-135deg)
  // Formula: screenAngle = fill/r + cssRotateRad; r=45, cssRotate=-135°=-2.35619rad
  if (fill > 2) {
    els.gaugeCapDot.style.opacity = "1";
    const screenAngle = fill / 45 + (-2.35619);
    const cx = 50 + 45 * Math.cos(screenAngle);
    const cy = 50 + 45 * Math.sin(screenAngle);
    els.gaugeCapDot.setAttribute("cx", cx.toFixed(2));
    els.gaugeCapDot.setAttribute("cy", cy.toFixed(2));
  } else {
    els.gaugeCapDot.style.opacity = "0";
  }
}

// ─── Inactivity detection ──────────────────────────────────────────────────
let lastActivityTime = Date.now();
let isInactive = false;

const INACTIVITY_THRESHOLD_MS = 3000;
const DEPLETION_RATE = 0.004; // per 100ms → full depletion in ~25s

setInterval(() => {
  const state = getState();
  if (state.inputMode === "idle") {
    // Don't fire inactivity logic when no input is connected
    if (isInactive) {
      isInactive = false;
      els.inactivityAlert.classList.add("hidden");
    }
    return;
  }

  const hasActivity = (state.energyScore ?? 0) > 0.01 || (state.motionScore ?? 0) > 0.01;
  if (hasActivity) {
    lastActivityTime = Date.now();
    if (isInactive) {
      isInactive = false;
      els.inactivityAlert.classList.add("hidden");
    }
    return;
  }

  const elapsed = Date.now() - lastActivityTime;
  if (elapsed > INACTIVITY_THRESHOLD_MS) {
    if (!isInactive) {
      isInactive = true;
      els.inactivityAlert.classList.remove("hidden");
    }
    // Deplete charge level
    if (state.chargeLevel > 0) {
      setState({ chargeLevel: Math.max(0, state.chargeLevel - DEPLETION_RATE) });
    }
  }
}, 100);

// ─── Helpers ───────────────────────────────────────────────────────────────
function setOn(el, on) {
  if (!el) return;
  el.classList.toggle("on", on);
  el.classList.toggle("off", !on);
}

function animateDots(level) {
  const dotsGroup = document.getElementById("energyDots");
  if (!dotsGroup) return;
  dotsGroup.innerHTML = "";
  const count = Math.max(2, Math.floor(level * 10));
  for (let i = 0; i < count; i++) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "energy-dot");
    dot.setAttribute("r", "4");
    const x = 468 + i * 18;
    const y = 188 - Math.sin(i * 0.55) * 18;
    dot.setAttribute("cx", `${x}`);
    dot.setAttribute("cy", `${y}`);
    dot.style.opacity = `${0.25 + (i / count) * 0.75}`;
    dotsGroup.appendChild(dot);
  }
}

function updateHouseUtilities(powered) {
  setOn(els.lightBedroom, powered);
  setOn(els.lightBathroom, powered);
  setOn(els.lightKitchen, powered);
  setOn(els.waterTank, powered);
  setOn(els.radiator, powered);
  setOn(els.boiler, powered);
  setOn(els.pump, powered);
  if (els.smoke) els.smoke.classList.toggle("active", powered);
  setOn(els.statusLights, powered);
  setOn(els.statusWater, powered);
  setOn(els.statusHeat, powered);
  setOn(els.statusPower, powered);
  setOn(els.statusSmoke, powered);
}

// ─── Render ────────────────────────────────────────────────────────────────
function render(state) {
  const displayCharge = state.chargeLevel ?? 0;
  const utilitiesPowered = Boolean(state.utilitiesPowered);

  els.rotationCount.textContent = String(state.rotations);
  els.wattValue.textContent = state.totalEnergy.toFixed(2);
  els.kcalValue.textContent = Math.round(state.kcal);
  els.promptValue.textContent = String(state.prompts);
  els.globalPrompts.textContent = `${(state.prompts * 10).toFixed(1)}K`;
  els.globalEnergy.textContent = `${(state.totalEnergy * 20).toFixed(1)}K`;

  updateGauge(displayCharge);
  updateHouseUtilities(utilitiesPowered);

  const endpoints = ["AI Cluster", "Data Cooling", "Prompt Engine", "Inference Grid"];
  const index = Math.min(endpoints.length - 1, Math.floor((state.energyScore ?? 0) * endpoints.length));
  els.endpointLabel.textContent = endpoints[index];

  animateDots((state.energyScore ?? 0) * 0.8);
}

subscribe(render);
render(getState());
