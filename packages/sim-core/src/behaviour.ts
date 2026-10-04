import { Rng } from "./rng";
import { constant } from "./reference";
import type { AnimalResult } from "./study";
import { lagSeries, type Observables } from "./observables";

/**
 * Behavioural endpoints. ILLUSTRATIVE.
 * Every output is a MODELLED ENDPOINT derived from organ damage, sickness, pain, CNS
 * exposure and disease burden. Nothing here is a claim about what the animal
 * experiences. Numeric scores are given relative to the animal's own baseline unless a
 * placeholder baseline exists in reference.json.
 *
 * Sickness behaviour follows the concept of Dantzer and Kelley (2007). The grimace score
 * in observables.ts follows the concept of Sotocinal et al. (2011). The observation
 * battery follows the concept of Irwin (1968, a mouse screen) and Moser (1989, rat FOB).
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface BehaviourDaily {
  /** net CNS drive after tolerance. Positive stimulation, negative sedation or withdrawal rebound. */
  netCns: Float64Array;
  /** home-cage activity relative to baseline (1 is baseline) */
  activityIndex: Float64Array;
  explorationIndex: Float64Array;
  /** 0 to 1 */
  anxietyLike: Float64Array;
  anhedoniaLike: Float64Array;
  /** 0 to 1, higher means more fragmented */
  sleepFragmentation: Float64Array;
  groomingIndex: Float64Array;
  nestingIndex: Float64Array;
  socialInteractionIndex: Float64Array;
  /** mean daily body temperature, deg C */
  bodyTempC: Float64Array;
  /** cognition capacity 0 to 1 used by the water maze */
  cognition: Float64Array;
}

export function behaviourDaily(r: AnimalResult, obs: Observables): BehaviourDaily {
  const n = obs.days + 1;
  const mk = () => new Float64Array(n);
  const out: BehaviourDaily = {
    netCns: mk(), activityIndex: mk(), explorationIndex: mk(), anxietyLike: mk(), anhedoniaLike: mk(),
    sleepFragmentation: mk(), groomingIndex: mk(), nestingIndex: mk(), socialInteractionIndex: mk(), bodyTempC: mk(), cognition: mk(),
  };
  // tolerance: slow adaptation to the CNS effect. After withdrawal the adaptation outlasts the drug, giving rebound.
  const adapt = lagSeries(obs.cnsEffect, 72, 24, 0);
  const chronic = lagSeries(obs.sickness, 7 * 24, 24);
  const tBase = constant("behaviour.bodyTemp.meanC");
  for (let d = 0; d < n; d++) {
    const S = obs.sickness[d]!;
    const net = obs.cnsEffect[d]! - 0.6 * adapt[d]!;
    out.netCns[d] = net;
    out.activityIndex[d] = Math.min(2, Math.max(0, (1 - 0.8 * S) * (1 + 0.8 * net)));
    out.explorationIndex[d] = Math.min(2, Math.max(0, (1 - 0.9 * S) * (1 + 0.3 * net)));
    out.anxietyLike[d] = clamp01(0.25 + 0.4 * S + 0.3 * Math.max(0, net) + 0.2 * Math.max(0, -net));
    out.anhedoniaLike[d] = clamp01(0.8 * chronic[d]! + 0.5 * Math.max(0, -net));
    out.sleepFragmentation[d] = clamp01(0.1 + 0.5 * S + 0.4 * obs.pain[d]! + 0.4 * Math.max(0, net));
    out.groomingIndex[d] = clamp01(1 - 0.9 * S);
    out.nestingIndex[d] = clamp01(1 - 0.8 * S - 0.3 * Math.max(0, -net));
    out.socialInteractionIndex[d] = clamp01(1 - 0.9 * S - 0.2 * out.anxietyLike[d]!);
    // fever-like rise with systemic inflammation at mild levels, hypothermia when severe
    out.bodyTempC[d] = tBase + 0.6 * S * (1 - S) * 4 * 0.5 - 2.5 * Math.max(0, S - 0.6) - 0.5 * Math.max(0, -net);
    out.cognition[d] = clamp01(1 - 1.2 * obs.damage.brain[d]! - 0.5 * Math.abs(net) * (net < 0 ? 1 : 0.5) - 0.3 * S - 0.3 * (r.disease.neuropathy[Math.min(r.timesH.length - 1, d * obs.stepsPerDay)] ?? 0));
  }
  return out;
}

/** One day of home-cage monitoring in 15-minute bins (lights on 00:00 to 12:00, off 12:00 to 24:00). */
export interface HomeCageDay {
  hours: Float64Array;
  activity: Float64Array;
  feeding: Float64Array;
  drinking: Float64Array;
  bodyTempC: Float64Array;
  /** fraction of activity occurring in the dark phase */
  darkFraction: number;
}

export function homeCageDay(r: AnimalResult, obs: Observables, beh: BehaviourDaily, day: number): HomeCageDay {
  const d = Math.min(obs.days, Math.max(0, Math.floor(day)));
  const rng = new Rng(r.config.seed).fork(`${r.config.animalId}/homecage-${d}`);
  const bins = 96;
  const hours = new Float64Array(bins), activity = new Float64Array(bins), feeding = new Float64Array(bins), drinking = new Float64Array(bins), temp = new Float64Array(bins);
  const S = obs.sickness[d]!;
  const frag = beh.sleepFragmentation[d]!;
  const amp = constant("behaviour.bodyTemp.circadianAmplitudeC");
  let tot = 0, dark = 0;
  for (let k = 0; k < bins; k++) {
    const h = (k + 0.5) / 4;
    hours[k] = h;
    // nocturnal drive peaking at hour 18, flattened by sickness and fragmentation
    const rhythm = Math.max(0, Math.cos((2 * Math.PI * (h - 18)) / 24));
    const amplitude = (1 - 0.7 * S) * (1 - 0.5 * frag * 0) ;
    const flat = 0.15 * frag + 0.05;
    const drive = (rhythm ** 1.3 * amplitude + flat * (1 - rhythm)) * beh.activityIndex[d]!;
    const a = Math.max(0, 40 * drive * (1 + 0.3 * rng.normal()));
    activity[k] = a;
    feeding[k] = Math.max(0, (obs.foodG[d]! / 8) * Math.max(0, rhythm) * (1 + 0.4 * rng.normal()) * 0.25 * 4 / 4);
    drinking[k] = Math.max(0, (obs.waterMl[d]! / 8) * Math.max(0, rhythm) * (1 + 0.4 * rng.normal()) * 0.25 * 4 / 4);
    temp[k] = beh.bodyTempC[d]! + amp * Math.cos((2 * Math.PI * (h - 18)) / 24) * (1 - 0.6 * S) + 0.04 * rng.normal();
    tot += a;
    if (h >= 12) dark += a;
  }
  // normalise intake so the day totals match the daily figures
  const norm = (arr: Float64Array, total: number) => { const s = arr.reduce((x, y) => x + y, 0); if (s > 0) for (let k = 0; k < arr.length; k++) arr[k] = (arr[k]! / s) * total; };
  norm(feeding, obs.foodG[d]!);
  norm(drinking, obs.waterMl[d]!);
  return { hours, activity, feeding, drinking, bodyTempC: temp, darkFraction: tot > 0 ? dark / tot : 0 };
}

// ---------------------------------------------------------------- observation battery

export interface Fob {
  /** ordinal scores, 0 is normal */
  posture: number; gait: number; arousal: number; reactivity: number; tremor: number; ataxia: number; convulsions: number;
  /** percent of the animal's own baseline */
  gripStrengthPct: number; rotarodLatencyPct: number; startleAmplitudePct: number; prepulseInhibitionPct: number; hindLimbSplayPct: number;
  /** fraction of attempts in which the righting reflex succeeds within 1 s */
  rightingReflex: number;
}

export function observationBattery(r: AnimalResult, obs: Observables, beh: BehaviourDaily, day: number): Fob {
  const d = Math.min(obs.days, Math.max(0, Math.floor(day)));
  const rng = new Rng(r.config.seed).fork(`${r.config.animalId}/fob-${d}`);
  const I = obs.signIntensity;
  const S = obs.sickness[d]!;
  const net = beh.netCns[d]!;
  const ord = (x: number) => Math.min(3, Math.max(0, Math.round(3 * clamp01(x) + 0.2 * rng.normal())));
  const jitter = (v: number, sd: number) => Math.max(0, v * (1 + sd * rng.normal()));
  const neuro = obs.damage.brain[d]! + 0.5 * (r.disease.neuropathy[Math.min(r.timesH.length - 1, d * obs.stepsPerDay)] ?? 0);
  return {
    posture: Math.min(2, Math.round(2 * I.hunchedPosture[d]!)),
    gait: ord(0.8 * I.ataxia[d]! + 0.3 * S),
    arousal: Math.round(Math.min(3, Math.max(-3, 3 * net - 2 * S))),
    reactivity: ord(Math.abs(net) * 0.8 + 0.3 * S),
    tremor: ord(I.tremor[d]!),
    ataxia: ord(I.ataxia[d]!),
    convulsions: ord(I.convulsions[d]!),
    gripStrengthPct: jitter(100 * (1 - 0.5 * S - 0.6 * neuro), 0.05),
    rotarodLatencyPct: jitter(100 * (1 - 0.8 * I.ataxia[d]! - 0.4 * S - 0.3 * Math.max(0, -net)), 0.08),
    startleAmplitudePct: jitter(100 * (1 + 0.5 * Math.max(0, net) - 0.6 * S), 0.1),
    prepulseInhibitionPct: Math.max(0, jitter(100 * (1 - 0.6 * neuro - 0.3 * Math.abs(net)), 0.08)),
    hindLimbSplayPct: jitter(100 * (1 + 0.6 * (r.disease.neuropathy[Math.min(r.timesH.length - 1, d * obs.stepsPerDay)] ?? 0) + 0.4 * neuro), 0.05),
    rightingReflex: clamp01(1 - 0.9 * I.ataxia[d]! - 0.3 * Math.max(0, -net) + 0.02 * rng.normal()),
  };
}

// ---------------------------------------------------------------- behavioural tests

export interface OpenField { distanceCm: number; centerTimeFraction: number; rearings: number }
export function openField(beh: BehaviourDaily, day: number, seed: number): OpenField {
  const d = Math.min(beh.netCns.length - 1, Math.max(0, Math.floor(day)));
  const rng = new Rng(seed).fork(`openfield-${d}`);
  const dist = constant("behaviour.openField.distanceCm5min") * beh.explorationIndex[d]! * rng.lognormalFactor(0.1);
  const center = Math.max(0, 0.15 * (1 - 1.2 * (beh.anxietyLike[d]! - 0.25)) * rng.lognormalFactor(0.1));
  return { distanceCm: dist, centerTimeFraction: Math.min(1, center), rearings: Math.round(30 * beh.explorationIndex[d]! * rng.lognormalFactor(0.15)) };
}

export function elevatedPlusMaze(beh: BehaviourDaily, day: number, seed: number): { openArmFraction: number; entries: number } {
  const d = Math.min(beh.netCns.length - 1, Math.max(0, Math.floor(day)));
  const rng = new Rng(seed).fork(`epm-${d}`);
  const base = constant("behaviour.epm.openArmFraction");
  return {
    openArmFraction: clamp01(base * (1 - 1.2 * (beh.anxietyLike[d]! - 0.25)) * rng.lognormalFactor(0.1)),
    entries: Math.round(14 * beh.explorationIndex[d]! * rng.lognormalFactor(0.15)),
  };
}

export function sucrosePreference(beh: BehaviourDaily, day: number, seed: number): number {
  const d = Math.min(beh.netCns.length - 1, Math.max(0, Math.floor(day)));
  const rng = new Rng(seed).fork(`sucrose-${d}`);
  return clamp01(constant("behaviour.sucrosePreference") * (1 - 0.6 * beh.anhedoniaLike[d]!) * rng.lognormalFactor(0.04));
}

/** Immobility in the forced swim test, used only as a depression-like concept. */
export function forcedSwimImmobility(beh: BehaviourDaily, obs: Observables, day: number, seed: number): number {
  const d = Math.min(beh.netCns.length - 1, Math.max(0, Math.floor(day)));
  const rng = new Rng(seed).fork(`fst-${d}`);
  return clamp01((constant("behaviour.forcedSwim.immobility") + 0.4 * beh.anhedoniaLike[d]! + 0.3 * obs.sickness[d]!) * rng.lognormalFactor(0.08));
}

/**
 * Water-maze style spatial learning on an 8 x 8 grid with a hidden platform: a tabular
 * Q-learning agent whose learning rate scales with cognition. Returns escape latency per
 * trial in seconds and the route of the last trial.
 */
export function waterMaze(seed: number, cognition: number, trials = 20): { latencySec: number[]; lastRoute: Array<[number, number]>; platform: [number, number] } {
  const G = 8;
  const rng = new Rng(seed).fork("water-maze");
  const goal: [number, number] = [rng.int(2, 6), rng.int(2, 6)];
  const acts: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const starts: Array<[number, number]> = [[0, 0], [0, G - 1], [G - 1, 0], [G - 1, G - 1], [0, 3], [G - 1, 4], [3, 0], [4, G - 1]];
  const Q = Array.from({ length: G * G }, () => [0, 0, 0, 0]);
  const alpha = Math.min(0.9, Math.max(0.02, 0.5 * cognition));
  const eps0 = 0.3 + 0.4 * (1 - cognition);
  const latency: number[] = [];
  let lastRoute: Array<[number, number]> = [];
  for (let k = 0; k < trials; k++) {
    let [x, y] = starts[rng.int(0, starts.length)]!;
    const route: Array<[number, number]> = [[x, y]];
    let steps = 0;
    const eps = Math.min(0.9, Math.max(0.05 + 0.2 * (1 - cognition), eps0 * Math.exp(-k / 6)));
    while ((x !== goal[0] || y !== goal[1]) && steps < 200) {
      const q = Q[x * G + y]!;
      let ai: number;
      if (rng.uniform() < eps) ai = rng.int(0, 4);
      else { const m = Math.max(...q); const best = q.map((v, i) => (v >= m - 1e-9 ? i : -1)).filter((i) => i >= 0); ai = best[rng.int(0, best.length)]!; }
      const nx = Math.min(G - 1, Math.max(0, x + acts[ai]![0])), ny = Math.min(G - 1, Math.max(0, y + acts[ai]![1]));
      const done = nx === goal[0] && ny === goal[1];
      q[ai] = q[ai]! + alpha * ((done ? 1 : -0.01) + (done ? 0 : 0.95 * Math.max(...Q[nx * G + ny]!)) - q[ai]!);
      x = nx; y = ny; steps++; route.push([x, y]);
    }
    latency.push(steps * 0.4);
    lastRoute = route;
  }
  return { latencySec: latency, lastRoute, platform: goal };
}

/** Replayable open-field track (5 Hz) with wall preference that grows with anxiety-like state. */
export function openFieldTrack(beh: BehaviourDaily, day: number, seed: number, seconds = 300): { x: Float32Array; y: Float32Array; hz: number } {
  const d = Math.min(beh.netCns.length - 1, Math.max(0, Math.floor(day)));
  const rng = new Rng(seed).fork(`track-${d}`);
  const hz = 5, n = seconds * hz;
  const x = new Float32Array(n), y = new Float32Array(n);
  let px = 0.5, py = 0.5, heading = rng.range(0, 2 * Math.PI);
  const speed = 0.012 * beh.explorationIndex[d]!;
  const wall = 0.4 + 0.6 * beh.anxietyLike[d]!;
  for (let i = 0; i < n; i++) {
    heading += 0.35 * rng.normal();
    const cx = 0.5 - px, cy = 0.5 - py;
    // thigmotaxis: pushed outward from the centre, scaled by anxiety
    px += Math.cos(heading) * speed - cx * 0.004 * wall * -1 * 0.2;
    py += Math.sin(heading) * speed - cy * 0.004 * wall * -1 * 0.2;
    if (px < 0.02 || px > 0.98) { heading = Math.PI - heading; px = Math.min(0.98, Math.max(0.02, px)); }
    if (py < 0.02 || py > 0.98) { heading = -heading; py = Math.min(0.98, Math.max(0.02, py)); }
    x[i] = px; y[i] = py;
  }
  return { x, y, hz };
}
