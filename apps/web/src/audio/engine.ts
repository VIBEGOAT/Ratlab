/**
 * Web Audio engine. Loaded only when the viewer turns sound on (dynamic import), so it costs nothing otherwise.
 * Everything is synthesised: a very quiet UI tick, a low ambient bed, and a soft heartbeat. Kept deliberately
 * gentle. The humane endpoint fades to silence, driven by soundPlan().
 */
import type { SoundPlan } from "./soundPlan";

export interface Engine {
  setPlan: (p: SoundPlan) => void;
  tick: () => void;
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
    suspend() { void ctx.suspend(); },
    resume() { void ctx.resume(); },
    dispose() {
      window.clearInterval(scheduler);
      for (const o of [...oscs, lfo]) { try { o.stop(); } catch { /* already stopped */ } }
      void ctx.close();
    },
  };
}
