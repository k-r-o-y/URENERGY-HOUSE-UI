import { getState, resetState, subscribe, setState } from "./state.js";
import { MotionTracker } from "./motion.js";
import { CrankTracker } from "./crank.js";

const els = {
  cameraFeed: document.getElementById("cameraFeed"),
  motionCanvas: document.getElementById("motionCanvas"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  connectCrankBtn: document.getElementById("connectCrankBtn"),

  rotationCount: document.getElementById("rotationCount"),
  wattValue: document.getElementById("wattValue"),
  kcalValue: document.getElementById("kcalValue"),
  timeValue: document.getElementById("timeValue"),
  promptValue: document.getElementById("promptValue"),
  globalPrompts: document.getElementById("globalPrompts"),
  globalEnergy: document.getElementById("globalEnergy"),
  capPercent: document.getElementById("capPercent"),
  capFill: document.getElementById("capFill"),
  endpointLabel: document.getElementById("endpointLabel"),
  userShareValue: document.getElementById("userShareValue"),
  userShareBar: document.getElementById("userShareBar"),
  modeValue: document.getElementById("modeValue"),

  smoke: document.getElementById("chimneySmoke"),

  lightBedroom: document.getElementById("utility-light-bedroom"),
  lightBathroom: document.getElementById("utility-light-bathroom"),
  lightKitchen: document.getElementById("utility-light-kitchen"),
  waterTank: document.getElementById("utility-water-tank"),
  radiator: document.getElementById("utility-radiator"),
  boiler: document.getElementById("utility-boiler"),
  pump: document.getElementById("utility-pump"),

  statusLights: document.getElementById("statusLights"),
  statusWater: document.getElementById("statusWater"),
  statusHeat: document.getElementById("statusHeat"),
  statusPower: document.getElementById("statusPower"),
  statusSmoke: document.getElementById("statusSmoke"),
};

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

els.startCameraBtn.addEventListener("click", startCamera);
els.connectCrankBtn.addEventListener("click", connectCrank);

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

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

  for (let i = 0; i < count; i += 1) {
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

  if (els.smoke) {
    els.smoke.classList.toggle("active", powered);
  }

  setOn(els.statusLights, powered);
  setOn(els.statusWater, powered);
  setOn(els.statusHeat, powered);
  setOn(els.statusPower, powered);
  setOn(els.statusSmoke, powered);
}

function render(state) {
  const homeShare = 0.2;
  const platformShare = 0.8;

  const displayCharge = state.chargeLevel ?? 0;
  const utilitiesPowered = Boolean(state.utilitiesPowered);

  els.rotationCount.textContent = String(state.rotations);
  els.wattValue.textContent = state.totalEnergy.toFixed(2);
  els.kcalValue.textContent = Math.round(state.kcal);
  els.timeValue.textContent = formatTime(state.seconds);
  els.promptValue.textContent = String(state.prompts);
  els.globalPrompts.textContent = `${(state.prompts * 10).toFixed(1)}K`;
  els.globalEnergy.textContent = `${(state.totalEnergy * 20).toFixed(1)}K`;

  els.capPercent.textContent = `${Math.round(displayCharge * 100)}%`;
  els.capFill.style.width = `${displayCharge * 100}%`;

  els.userShareValue.textContent = `${Math.round(homeShare * 100)}%`;
  els.userShareBar.style.width = `${homeShare * 100}%`;

  els.modeValue.textContent =
    state.inputMode === "camera"
      ? "CAMERA"
      : state.inputMode === "crank"
        ? "CRANK"
        : "IDLE";

  updateHouseUtilities(utilitiesPowered);

  const endpoints = [
    "AI Cluster",
    "Data Cooling",
    "Prompt Engine",
    "Inference Grid",
  ];

  const index = Math.min(
    endpoints.length - 1,
    Math.floor((state.energyScore ?? 0) * endpoints.length),
  );
  els.endpointLabel.textContent = endpoints[index];

  animateDots((state.energyScore ?? 0) * platformShare);
}

subscribe(render);
render(getState());
