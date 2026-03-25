const state = {
  cameraReady: false,
  motionScore: 0,
  energyScore: 0,
  rotations: 0,
  kcal: 0,
  seconds: 0,
  prompts: 0,
  totalEnergy: 0,
  chargeLevel: 0,
  utilitiesPowered: false,
  inputMode: "idle",
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
}

export function resetState(patch = {}) {
  Object.assign(state, {
    cameraReady: false,
    motionScore: 0,
    energyScore: 0,
    rotations: 0,
    kcal: 0,
    seconds: 0,
    prompts: 0,
    totalEnergy: 0,
    chargeLevel: 0,
    utilitiesPowered: false,
    inputMode: "idle",
    ...patch,
  });

  listeners.forEach((listener) => listener(state));
}
