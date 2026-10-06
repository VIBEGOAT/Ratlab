/**
 * Web Audio engine. Loaded only when the viewer turns sound on (dynamic import), so it costs nothing otherwise.
 * Everything is synthesised: a very quiet UI tick, a low ambient bed, a soft heartbeat, and the rat's own sounds
 * (sniffing, a short chirp, footsteps, the heart at its modelled rate). Kept deliberately gentle. The humane endpoint
 * fades to silence, driven by soundPlan(); the rat's sounds are scheduled by ambiencePlan().
 */
import type { SoundPlan } from "./soundPlan";

export interface Engine {
  setPlan: (p: SoundPlan) => void;
  tick: () => void;
  /** a short, rising chirp, in the hearing range (real rat calls are mostly ultrasonic) */
  chirp: () => void;
  /** a few quick sniffs; strength 0 to 1 */
  sniff: (strength: number) => void;
  /** light footsteps on bedding */
  patter: (steps: number) => void;
  /** the heart at a given rate for a few seconds */
  heart: (bpm: number, seconds: number) => void;
  suspend: () => void;
  resume: () => void;
  dispose: () => void;
}

export async function createEngine(): Promise<Engine | null> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  // ambient bed: two low sines a fifth apart, slowly breathing
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = "lowpass";
  bedFilter.frequency.value = 220;
  bedGain.connect(bedFilter).connect(master);
  const oscs = [55, 82.4].map((f) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(bedGain); o.start(); return o; });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 30;
  lfo.connect(lfoDepth).connect(bedFilter.frequency);
  lfo.start();

  // heartbeat: a soft "lub-dub" pair scheduled just ahead of time
  const beatGain = ctx.createGain();
  beatGain.gain.value = 0;
  beatGain.connect(master);
  let beatLevel = 0, bpm = 70, nextBeat = ctx.currentTime + 0.2;
  const thump = (t: number, f: number, peak: number) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(beatGain);
    o.start(t); o.stop(t + 0.2);
  };
  const scheduler = window.setInterval(() => {
    if (beatLevel <= 0.001) { nextBeat = Math.max(nextBeat, ctx.currentTime + 0.1); return; }
    while (nextBeat < ctx.currentTime + 0.4) {
      thump(nextBeat, 62, 0.9);
      thump(nextBeat + 0.17, 50, 0.55);
      nextBeat += 60 / bpm;
    }
  }, 100);

  // ---- the rat's own sounds, on their own gain so they stay quiet next to everything else
  const fx = ctx.createGain();
  fx.gain.value = 0.9;
  fx.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const burst = (t: number, dur: number, freq: number, q: number, peak: number) => {
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.015, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(fx);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  };
  let heartUntil = 0;

  const ramp = (p: AudioParam, v: number, s = 0.4) => { p.cancelScheduledValues(ctx.currentTime); p.setTargetAtTime(v, ctx.currentTime, s); };

  return {
    setPlan(p) {
      beatLevel = p.beat; bpm = p.beatBpm;
      ramp(bedGain.gain, p.bed * 0.07, 0.6);
      ramp(beatGain.gain, p.beat * 0.22, 0.5);
    },
    tick() {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 1500;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.07);
    },
    chirp() {
      const t = ctx.currentTime + 0.01;
      const one = (t0: number, f0: number, f1: number, dur: number, peak: number) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), hp = ctx.createBiquadFilter(), vib = ctx.createOscillator(), vd = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.6);
        o.frequency.exponentialRampToValueAtTime(f1 * 0.86, t0 + dur);
        vib.frequency.value = 38; vd.gain.value = 90;
        vib.connect(vd).connect(o.frequency);
        hp.type = "highpass"; hp.frequency.value = 1400;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(hp).connect(g).connect(fx);
        o.start(t0); vib.start(t0); o.stop(t0 + dur + 0.02); vib.stop(t0 + dur + 0.02);
      };
      const base = 2900 + Math.random() * 500;
      one(t, base, base * 1.35, 0.085, 0.045);
      if (Math.random() < 0.45) one(t + 0.12, base * 1.05, base * 1.42, 0.07, 0.032);
    },
    sniff(strength) {
      const k = Math.max(0, Math.min(1, strength));
      if (k <= 0.02) return;
      const n = 2 + Math.round(Math.random() * 2 * k);
      const gap = 0.11 + (1 - k) * 0.06;
      for (let i = 0; i < n; i++) burst(ctx.currentTime + 0.02 + i * gap, 0.06, 2600 + Math.random() * 900, 1.3, 0.05 * k);
    },
    patter(steps) {
      let t = ctx.currentTime + 0.01;
      for (let i = 0; i < Math.min(12, steps); i++) { burst(t, 0.018, 3800 + Math.random() * 1500, 3, 0.022); t += 0.06 + Math.random() * 0.07; }
    },
    heart(bpm, seconds) {
      const start = Math.max(ctx.currentTime + 0.05, heartUntil);
      const period = 60 / Math.max(30, bpm);
      const end = start + seconds;
      for (let t = start; t < end; t += period) {
        thump(t, 70, 0.75);
        thump(t + period * 0.38, 55, 0.4);
      }
      heartUntil = end;
      // the heartbeat voice shares beatGain with the story bed, so open it for this phrase only
      beatGain.gain.cancelScheduledValues(ctx.currentTime);
      beatGain.gain.setTargetAtTime(0.2, ctx.currentTime, 0.05);
      beatGain.gain.setTargetAtTime(beatLevel * 0.22, end, 0.2);
    },
    suspend() { void ctx.suspend(); },
    resume() { void ctx.resume(); },
    dispose() {
      window.clearInterval(scheduler);
      for (const o of [...oscs, lfo]) { try { o.stop(); } catch { /* already stopped */ } }
      void ctx.close();
    },
  };
}
