function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export class MotionTracker {
  constructor({ video, canvas, onUpdate }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.onUpdate = onUpdate;

    this.stream = null;
    this.running = false;
    this.prevFrame = null;
    this.lastTime = 0;
    this.lastRotationTick = 0;
    this.startTime = 0;
    this.kcal = 0;
    this.rotations = 0;
    this.prompts = 0;
    this.totalEnergy = 0;
    this.chargeLevel = 0;
    this.rafId = null;

    this.freezeStartedAt = null;
    this.freezeDuration = 1800;
    this.frozen = false;

    this.displayMotion = 0;
    this.displayEnergy = 0;
    this.finalSeconds = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    this.video.srcObject = this.stream;
    await this.video.play();

    this.canvas.width = 160;
    this.canvas.height = 120;
    this.running = true;
    this.prevFrame = null;
    this.lastTime = performance.now();
    this.lastRotationTick = 0;
    this.startTime = performance.now();
    this.kcal = 0;
    this.rotations = 0;
    this.prompts = 0;
    this.totalEnergy = 0;
    this.chargeLevel = 0;
    this.freezeStartedAt = null;
    this.frozen = false;
    this.displayMotion = 0;
    this.displayEnergy = 0;
    this.finalSeconds = 0;

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this.running = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.video.srcObject = null;
    this.prevFrame = null;
  }

  loop(now) {
    if (!this.running) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (!this.freezeStartedAt) {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const frame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

      let diff = 0;

      if (this.prevFrame) {
        for (let i = 0; i < frame.length; i += 16) {
          diff += Math.abs(frame[i] - this.prevFrame[i]);
        }
      }

      this.prevFrame = new Uint8ClampedArray(frame);

      const rawMotion = clamp(diff / 40000);
      const rawEnergy = clamp(rawMotion * 1.15);

      this.displayMotion += (rawMotion - this.displayMotion) * 0.22;
      this.displayEnergy += (rawEnergy - this.displayEnergy) * 0.22;

      if (this.displayMotion > 0.12 && now - this.lastRotationTick > 450) {
        this.rotations += 1;
        this.lastRotationTick = now;
      }

      this.kcal += this.displayMotion * 0.24;
      this.totalEnergy += this.displayEnergy * 3.8;
      this.prompts = Math.floor(this.totalEnergy / 6.5);

      const fillRate =
        this.displayMotion * 0.18 +
        Math.pow(this.displayMotion, 1.35) * 0.55;

      this.chargeLevel = clamp(this.chargeLevel + fillRate * dt);

      if (this.chargeLevel > 0.9 && this.chargeLevel < 1) {
        this.chargeLevel = clamp(this.chargeLevel + 0.008);
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
      cameraReady: true,
      motionScore: this.displayMotion,
      energyScore: utilitiesPowered ? 1 : this.displayEnergy,
      rotations: this.rotations,
      kcal: this.kcal,
      seconds,
      prompts: this.prompts,
      totalEnergy: this.totalEnergy,
      chargeLevel: this.chargeLevel,
      utilitiesPowered,
      inputMode: "camera",
    });

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }
}
