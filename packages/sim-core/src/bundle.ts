import type { AnimalConfig, AnimalResult } from "./study";
import { simulateTwin } from "./twin";
import {
  clinicalPathology, cardiacMarkers, makeClinPathContext, myelosuppression, necropsy, renalInjuryMarkers, hysLawCheck,
  type Observables, type Panel, type Necropsy, type CardiacMarkers,
} from "./observables";
import {
  behaviourDaily, homeCageDay, observationBattery, openField, elevatedPlusMaze, sucrosePreference, forcedSwimImmobility, waterMaze,
  openFieldTrack, type Fob, type HomeCageDay,
} from "./behaviour";
import type { HumaneEvent } from "./humane";
import { ORGANS, type Organ } from "./toxicodynamics";
import { TISSUES, type Tissue } from "./physiology";
import { DISEASE_SERIES, type DiseaseReading } from "./disease";

/**
 * Everything the interface needs about one animal, in plain arrays and objects that can be
 * sent across a Web Worker boundary. Time courses are sampled hourly, daily series per day.
 */
export interface DailyClinPath {
  chemistry: Panel;
  hematology: Panel;
  hysLaw: { met: boolean; altXuln: number; bilirubinXuln: number };
  cardiac: CardiacMarkers;
  kidneyInjuryMarkerFold: number;
}

export interface AnimalBundle {
  id: string;
  doseMgPerKg: number;
  days: number;
  stepsPerDay: number;
  hoursH: number[];
  plasma: number[];
  tissue: Record<Tissue, number[]>;
  damage: Partial<Record<Organ, number[]>>;
  defence: Partial<Record<Organ, number[]>>;
  pd: Record<string, number[]>;
  disease: Record<keyof DiseaseReading, number[]>;
  pk: AnimalResult["pk"];
  physiology: { bwKg: number; sex: string; cypFactor: number; renalFactor: number };
  /** daily series */
  daily: {
    damage: Record<Organ, number[]>;
    bodyWeightG: number[]; weightChangeFraction: number[]; foodG: number[]; waterMl: number[];
    sickness: number[]; pain: number[]; grimace: number[]; cnsEffect: number[]; cnsPeak: number[];
    tumorVolume: number[]; glucose: number[];
    signIntensity: Record<string, number[]>; signObserved: Record<string, number[]>;
    behaviour: Record<string, number[]>;
  };
  clinpath: DailyClinPath[];
  homeCage: HomeCageDay[];
  fob: Fob[];
  tests: Array<{ openField: ReturnType<typeof openField>; epm: ReturnType<typeof elevatedPlusMaze>; sucrose: number; forcedSwim: number }>;
  necropsyTerminal: Necropsy;
  humane: HumaneEvent | null;
  myelosuppression: ReturnType<typeof myelosuppression>;
  waterMaze: ReturnType<typeof waterMaze>;
  track: { x: number[]; y: number[]; hz: number };
}

const arr = (a: ArrayLike<number>): number[] => Array.from(a);
const hourly = (a: Float64Array): number[] => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i += 4) out.push(a[i]!);
  return out;
};

export function buildAnimalBundle(r: AnimalResult, obs: Observables, humane: HumaneEvent | null): AnimalBundle {
  const beh = behaviourDaily(r, obs);
  const ctx = makeClinPathContext(r, obs);
  const days = obs.days;
  const tissue = {} as Record<Tissue, number[]>;
  for (const t of TISSUES) tissue[t] = hourly(r.tissue[t]);
  const damage: AnimalBundle["damage"] = {};
  const defence: AnimalBundle["defence"] = {};
  for (const o of ORGANS) {
    if (r.damage[o]) damage[o] = hourly(r.damage[o]!);
    if (r.defence[o]) defence[o] = hourly(r.defence[o]!);
  }
  const pd: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(r.pd)) pd[k] = hourly(v);
  const disease = {} as AnimalBundle["disease"];
  for (const k of DISEASE_SERIES) disease[k] = hourly(r.disease[k]);

  const clinpath: DailyClinPath[] = [];
  const homeCage: HomeCageDay[] = [];
  const fob: Fob[] = [];
  const tests: AnimalBundle["tests"] = [];
  for (let d = 0; d <= days; d++) {
    const cp = clinicalPathology(ctx, d);
    clinpath.push({ chemistry: cp.chemistry, hematology: cp.hematology, hysLaw: hysLawCheck(cp.chemistry), cardiac: cardiacMarkers(obs, d), kidneyInjuryMarkerFold: renalInjuryMarkers(obs, d).kidneyInjuryMarkerFold });
    homeCage.push(homeCageDay(r, obs, beh, d));
    fob.push(observationBattery(r, obs, beh, d));
    tests.push({
      openField: openField(beh, d, r.config.seed), epm: elevatedPlusMaze(beh, d, r.config.seed),
      sucrose: sucrosePreference(beh, d, r.config.seed), forcedSwim: forcedSwimImmobility(beh, obs, d, r.config.seed),
    });
  }
  const track = openFieldTrack(beh, days, r.config.seed);
  const od = {} as Record<Organ, number[]>;
  for (const o of ORGANS) od[o] = arr(obs.damage[o]);
  const si: Record<string, number[]> = {};
  const so: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(obs.signIntensity)) si[k] = arr(v);
  for (const [k, v] of Object.entries(obs.signObserved)) so[k] = arr(v);
  const bh: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(beh)) bh[k] = arr(v as Float64Array);
  return {
    id: r.config.animalId, doseMgPerKg: r.config.regimen.doseMgPerKg, days, stepsPerDay: obs.stepsPerDay,
    hoursH: hourly(r.timesH), plasma: hourly(r.plasma), tissue, damage, defence, pd, disease, pk: r.pk,
    physiology: { bwKg: r.physiology.bwKg, sex: r.physiology.sex, cypFactor: r.physiology.cypFactor, renalFactor: r.physiology.renalFactor },
    daily: {
      damage: od, bodyWeightG: arr(obs.bodyWeightG), weightChangeFraction: arr(obs.weightChangeFraction), foodG: arr(obs.foodG), waterMl: arr(obs.waterMl),
      sickness: arr(obs.sickness), pain: arr(obs.pain), grimace: arr(obs.grimace), cnsEffect: arr(obs.cnsEffect), cnsPeak: arr(obs.cnsPeak),
      tumorVolume: arr(obs.tumorVolume), glucose: arr(obs.glucose), signIntensity: si, signObserved: so, behaviour: bh,
    },
    clinpath, homeCage, fob, tests, necropsyTerminal: necropsy(r, obs, days), humane, myelosuppression: myelosuppression(ctx),
    waterMaze: waterMaze(r.config.seed, beh.cognition[days] ?? 1, 20), track: { x: arr(track.x), y: arr(track.y), hz: track.hz },
  };
}

export interface TwinBundle {
  treated: AnimalBundle;
  untreated: AnimalBundle;
  /** days later (positive) or earlier (negative) that treatment moved the first humane endpoint; null if neither reached one. +-1e9 means one arm never reached one. */
  humaneDelayDays: number | null;
}

export function simulateTwinBundle(cfg: AnimalConfig): TwinBundle {
  const tw = simulateTwin(cfg);
  return {
    treated: buildAnimalBundle(tw.treated.result, tw.treated.obs, tw.treated.humane),
    untreated: buildAnimalBundle(tw.untreated.result, tw.untreated.obs, tw.untreated.humane),
    humaneDelayDays: tw.humaneDelayDays === Infinity ? 1e9 : tw.humaneDelayDays === -Infinity ? -1e9 : tw.humaneDelayDays,
  };
}
