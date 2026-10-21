import { describe, it, expect } from "vitest";
import { ARCHETYPES, configForAnimal, defaultDesign, runStudy, simulateTwinBundle, type Organ } from "@eliminate/sim-core";
import { TRACKS, secondsBefore, trackSeconds } from "./tracks";
import { PREDICT_ORGANS, addVote, emptyVotes, firstToFail, shareCorrect, totalVotes } from "./prediction";
import { scrollYFor } from "./scroll";
import { ambiencePlan, audibleBpm, soundPlan } from "../audio/soundPlan";

describe("demo tracks", () => {
  it("run for about 3 and 8 minutes", () => {
    expect(trackSeconds("3min")).toBeGreaterThanOrEqual(175);
    expect(trackSeconds("3min")).toBeLessThanOrEqual(185);
    expect(trackSeconds("8min")).toBeGreaterThanOrEqual(470);
    expect(trackSeconds("8min")).toBeLessThanOrEqual(490);
  });
  it("only point at real chapters, with valid progress, notes and a title", () => {
    for (const t of Object.values(TRACKS)) {
      for (const s of t.slides) {
        expect(s.chapter).toBeGreaterThanOrEqual(0);
        expect(s.chapter).toBeLessThanOrEqual(5);
        for (const p of [s.from, s.to]) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
        expect(s.to).toBeGreaterThanOrEqual(s.from);
        expect(s.notes.length).toBeGreaterThan(60);
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.seconds).toBeGreaterThan(5);
      }
      expect(new Set(t.slides.map((s) => s.id)).size).toBe(t.slides.length);
    }
  });
  it("visits the six connected teaching stations in order", () => {
    for (const t of Object.values(TRACKS)) {
      const ids = t.slides.map((s) => s.id);
      expect(ids).toEqual(['compound', 'dose', 'distribution', 'organs', 'response', 'human']);
    }
  });
  it("states the caveats out loud in the notes", () => {
    const all = TRACKS["8min"].slides.map((s) => s.notes).join(" ");
    expect(all).toMatch(/does not replace animal studies/);
    expect(all).toMatch(/unverified/);
    expect(all).toMatch(/never guide a real dose/);
    expect(all).toMatch(/not a claim about what the animal feels/);
  });
  it("sums elapsed time correctly", () => {
    expect(secondsBefore("3min", 0)).toBe(0);
    expect(secondsBefore("3min", TRACKS["3min"].slides.length)).toBe(trackSeconds("3min"));
  });
});

describe("audience prediction", () => {
  it("offers five organs", () => { expect(PREDICT_ORGANS.length).toBe(5); });

  it("tallies votes, never goes negative, and reports the share that guessed right", () => {
    let v = emptyVotes();
    expect(shareCorrect(v, "heart")).toBeNull();
    v = addVote(addVote(addVote(v, "heart"), "heart"), "liver");
    expect(totalVotes(v)).toBe(3);
    expect(shareCorrect(v, "heart")).toBeCloseTo(2 / 3, 10);
    expect(addVote(v, "brain", -5).brain).toBe(0);
  });

  const fake = (series: Partial<Record<Organ, number[]>>, days = 5) => {
    const damage = { liver: [0], kidney: [0], heart: [0], brain: [0], gut: [0], marrow: [0], ...series } as Record<Organ, number[]>;
    return { days, daily: { damage } } as unknown as Parameters<typeof firstToFail>[0];
  };

  it("picks the organ that reaches mild injury first, and ties go to the larger damage", () => {
    expect(firstToFail(fake({ heart: [0, 0, 0.2, 0.3], liver: [0, 0, 0, 0.5] })).organ).toBe("heart");
    expect(firstToFail(fake({ heart: [0, 0, 0.2], marrow: [0, 0, 0.4] })).organ).toBe("marrow");
    expect(firstToFail(fake({ heart: [0, 0, 0.2] })).day).toBe(2);
  });

  it("falls back to the highest peak when nothing reaches mild injury, and ignores the gut", () => {
    const r = firstToFail(fake({ liver: [0, 0.05], kidney: [0, 0.1], gut: [0, 0.9] }));
    expect(r.organ).toBe("kidney");
    expect(r.day).toBeNull();
    expect(r.basis).toBe("highest peak injury");
  });

  it("gives a real answer for a simulated animal", () => {
    const d = defaultDesign(ARCHETYPES.cardiotoxin!, { nPerSexPerGroup: 2, durationDays: 28, seed: 42, disease: { cancer: {} }, sexes: ["M"] });
    const s = runStudy(d);
    const a = s.animals.find((x) => x.group === "G4")!;
    const r = firstToFail(simulateTwinBundle(configForAnimal(d, a)).treated);
    expect(PREDICT_ORGANS).toContain(r.organ);
    expect(r.organ).toBe("heart");
  }, 60000);
});

describe("scroll arithmetic", () => {
  it("puts the viewport middle at the requested point of an element", () => {
    expect(scrollYFor(1000, 800, 900, 0)).toBe(550);
    expect(scrollYFor(1000, 800, 900, 1)).toBe(1350);
    expect(scrollYFor(1000, 800, 900, 0.5)).toBe(950);
  });
  it("clamps progress", () => {
    expect(scrollYFor(1000, 800, 900, -3)).toBe(scrollYFor(1000, 800, 900, 0));
    expect(scrollYFor(1000, 800, 900, 9)).toBe(scrollYFor(1000, 800, 900, 1));
  });
});

describe("sound plan", () => {
  it("is silent outside the toxicity sequence", () => {
    for (const c of [0, 1, 2, 6, 7, 11]) expect(soundPlan(c, 0.5, 360)).toMatchObject({ bed: 0, beat: 0 });
  });
  it("has a heartbeat during damage and fades to complete silence for the humane endpoint", () => {
    expect(soundPlan(4, 0.5, 360).beat).toBeGreaterThan(0);
    const early = soundPlan(5, 0.05, 360), late = soundPlan(5, 0.8, 360);
    expect(early.beat).toBeGreaterThan(0);
    expect(late.beat).toBe(0);
    expect(late.bed).toBe(0);
    expect(soundPlan(5, 0.3, 360).beat).toBeLessThan(early.beat);
  });
  it("keeps the audible rate in a natural range", () => {
    expect(audibleBpm(360)).toBeCloseTo(72, 5);
    expect(audibleBpm(10)).toBe(48);
    expect(audibleBpm(9999)).toBe(110);
  });
});

describe("rat ambience", () => {
  it("a healthy rat sniffs often, chirps when clicked and moves", () => {
    const p = ambiencePlan(0, false, 1);
    expect(p.sniffEvery).not.toBeNull();
    expect(p.chirp).toBe(true);
    expect(p.sniffStrength).toBe(1);
    expect(p.steps).toBe(5);
  });
  it("a sick rat is quieter and rarer, and does not chirp", () => {
    const well = ambiencePlan(0, false), sick = ambiencePlan(0.6, false);
    expect(sick.chirp).toBe(false);
    expect(sick.sniffStrength).toBeLessThan(well.sniffStrength);
    expect(sick.sniffEvery![0]).toBeGreaterThan(well.sniffEvery![0]);
    expect(sick.steps).toBeLessThan(well.steps);
  });
  it("is silent at a humane endpoint or when very sick, and never makes a louder sound when sicker", () => {
    expect(ambiencePlan(0.2, true)).toEqual({ sniffEvery: null, sniffStrength: 0, chirp: false, steps: 0 });
    expect(ambiencePlan(0.9, false).sniffEvery).toBeNull();
    let last = Infinity;
    for (let s = 0; s <= 1; s += 0.05) { const v = ambiencePlan(s, false).sniffStrength; expect(v).toBeLessThanOrEqual(last); last = v; }
  });
  it("copes with missing numbers", () => {
    expect(ambiencePlan(NaN, false).chirp).toBe(true);
    expect(ambiencePlan(0, false, NaN).steps).toBe(5);
  });
});
