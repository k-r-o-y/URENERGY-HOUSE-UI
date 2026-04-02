export class CrankTracker {
  constructor({ onUpdate, spinsToComplete = 100 }) {
    this.onUpdate = onUpdate;
    this.spinsToComplete = spinsToComplete;

    this.port = null;
    this.reader = null;
    this.decoder = null;

    this.running = false;
    this.buffer = "";

    this.prevRotations = 0;

    this.totalRotations = 0;
    this.kcal = 0;
    this.prompts = 0;
    this.totalEnergy = 0;
    this.chargeLevel = 0;

    this.paused = false;
  }

  async connect() {
    if (!("serial" in navigator)) {
      throw new Error("Web Serial is not supported in this browser.");
    }

    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 9600 });

    this.decoder = new TextDecoder();
    this.reader = this.port.readable.getReader();

    this.running = true;
    this.buffer = "";
    this.prevRotations = 0;
    this.totalRotations = 0;
    this.kcal = 0;
    this.prompts = 0;
    this.totalEnergy = 0;
    this.chargeLevel = 0;

    this.readLoop();
  }

  async disconnect() {
    this.running = false;

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
      }
    } catch {}

    this.reader = null;

    try {
      if (this.port) {
        await this.port.close();
      }
    } catch {}

    this.port = null;
  }

  addSpin() {
    this.totalRotations += 1;
    this.kcal = this.totalRotations * 0.122;
    this.totalEnergy = this.totalRotations * 0.704;
    this.prompts = Math.floor(this.totalRotations / 3.55);
    this.chargeLevel = Math.min(1, this.chargeLevel + 1 / this.spinsToComplete);

    this.onUpdate({
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
  }

  handleLine(line) {
    const t = line.trim();
    if (!t) return;
    if (this.paused) return;

    let raw = null;

    if (t.startsWith("SPINS:")) {
      raw = parseInt(t.slice(6), 10);
    } else if (t.startsWith("SESSION_END:")) {
      return;
    } else if (/^\d+$/.test(t)) {
      raw = parseInt(t, 10);
    }

    if (raw === null || Number.isNaN(raw)) return;

    let delta;
    if (raw >= this.prevRotations) {
      delta = raw - this.prevRotations;
    } else {
      delta = raw;
    }
    this.prevRotations = raw;

    for (let i = 0; i < delta; i++) {
      this.addSpin();
    }
  }

  async readLoop() {
    while (this.running && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;

        this.buffer += this.decoder.decode(value, { stream: true });
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";

        for (const line of lines) {
          this.handleLine(line);
        }
      } catch {
        break;
      }
    }
  }
}
