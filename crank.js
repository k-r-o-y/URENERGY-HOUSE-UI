function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export class CrankTracker {
  constructor({ onUpdate }) {
    this.onUpdate = onUpdate;

    this.port = null;
    this.reader = null;
    this.decoder = null;

    this.running = false;
    this.startTime = 0;
    this.lastTime = 0;

    this.buffer = "";

    this.totalRotations = 0;
    this.prevRotations = 0;

    this.kcal = 0;
    this.prompts = 0;
    this.totalEnergy = 0;
    this.chargeLevel = 0;

    this.freezeStartedAt = null;
    this.freezeDuration = 2200;
    this.frozen = false;

    this.displayMotion = 0;
    this.displayEnergy = 0;

    this.rotationBurst = 0;
    this.finalSeconds = 0;
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
    this.startTime = performance.now();
    this.lastTime = performance.now();

    this.buffer = "";
    this.totalRotations = 0;
    this.prevRotations = 0;
    this.kcal = 0;
    this.prompts = 0;
    this.totalEnergy = 0;
    this.chargeLevel = 0;
    this.freezeStartedAt = null;
    this.frozen = false;
    this.displayMotion = 0;
    this.displayEnergy = 0;
    this.rotationBurst = 0;
    this.finalSeconds = 0;

    this.readLoop();
    requestAnimationFrame(this.loop.bind(this));
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

  handleLine(line) {
    const t = line.trim();
    if (!t) return;

    if (t.startsWith("SPINS:")) {
      const raw = parseInt(t.slice(6), 10);
      if (Number.isNaN(raw)) return;

      if (raw >= this.prevRotations) {
        const delta = raw - this.prevRotations;
        this.rotationBurst += delta;
      } else {
        this.rotationBurst += raw;
      }

      this.totalRotations = raw;
      this.prevRotations = raw;
      return;
    }

    if (t.startsWith("SESSION_END:")) {
      this.totalRotations = 0;
      this.prevRotations = 0;
      this.rotationBurst = 0;
      return;
    }

    if (/^\d+$/.test(t)) {
      const raw = parseInt(t, 10);
      if (raw >= this.prevRotations) {
        const delta = raw - this.prevRotations;
        this.rotationBurst += delta;
      } else {
        this.rotationBurst += raw;
      }

      this.totalRotations = raw;
      this.prevRotations = raw;
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

  loop(now) {
    if (!this.running) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (!this.freezeStartedAt) {
      const rotationsThisFrame = this.rotationBurst;
      this.rotationBurst = 0;

      const rotationsPerSecond = rotationsThisFrame / Math.max(dt, 0.001);

      const rawMotionScore = clamp(rotationsPerSecond / 5);
      const rawEnergyScore = clamp(rotationsPerSecond / 4.5);

      this.displayMotion += (rawMotionScore - this.displayMotion) * 0.25;
      this.displayEnergy += (rawEnergyScore - this.displayEnergy) * 0.25;

      this.kcal = this.totalRotations * 0.122;
      this.totalEnergy = this.totalRotations * 3.52;
      this.prompts = Math.floor(this.totalEnergy / 12.5);

      const rotationBoost = rotationsThisFrame * 0.012;
      const fillRate =
        this.displayMotion * 0.2 +
        Math.pow(this.displayMotion, 1.4) * 0.65 +
        rotationBoost;

      this.chargeLevel = clamp(this.chargeLevel + fillRate * dt);

      if (this.chargeLevel > 0.9 && this.chargeLevel < 1) {
        this.chargeLevel = clamp(this.chargeLevel + 0.01);
      }

      if (this.chargeLevel >= 0.995) {
        this.chargeLevel = 1;
        this.freezeStartedAt = now;
        this.finalSeconds = Math.floor((now - this.startTime) / 1000);
      }
    } else if (!this.frozen) {
      const elapsed = now - this.freezeStartedAt;
      const t = clamp(elapsed / this.freezeDuration);
      const easeOut = 1 - Math.pow(1 - t, 3);

      this.displayMotion *= 1 - 0.16 * easeOut;
      this.displayEnergy *= 1 - 0.18 * easeOut;

      if (t >= 1 || (this.displayMotion < 0.002 && this.displayEnergy < 0.002)) {
        this.displayMotion = 0;
        this.displayEnergy = 0;
        this.frozen = true;
      }
    }

    const seconds = this.freezeStartedAt
      ? this.finalSeconds
      : Math.floor((now - this.startTime) / 1000);

    const utilitiesPowered = this.chargeLevel >= 1;

    this.onUpdate({
      cameraReady: this.running,
      motionScore: this.displayMotion,
      energyScore: utilitiesPowered ? 1 : this.displayEnergy,
      rotations: this.totalRotations,
      kcal: this.kcal,
      seconds,
      prompts: this.prompts,
      totalEnergy: this.totalEnergy,
      chargeLevel: this.chargeLevel,
      utilitiesPowered,
      inputMode: "crank",
    });

    requestAnimationFrame(this.loop.bind(this));
  }
}
