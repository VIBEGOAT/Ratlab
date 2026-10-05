import { describe, it, expect, vi } from "vitest";
import { buildCommands, filterCommands, score, type PaletteActions } from "./commands";
import { CHAPTERS, SECTIONS } from "../lib/nav";
import { COMPOUNDS } from "../lib/setup";

const actions = (over: Partial<PaletteActions> = {}): PaletteActions => ({
  goStory: vi.fn(), goLab: vi.fn(), setCompound: vi.fn(), setDisease: vi.fn(), startPresenter: vi.fn(), openNotes: vi.fn(),
  setTheme: vi.fn(), toggleCb: vi.fn(), cbOn: false, setQuality: vi.fn(), toggleSound: vi.fn(), soundOn: false, hasData: true,
  exportCsv: vi.fn(), exportJson: vi.fn(), exportHtml: vi.fn(), rerun: vi.fn(), ...over,
});

describe("command list", () => {
  it("has unique ids and covers every chapter, every Lab view and every compound", () => {
    const cmds = buildCommands(actions());
    const ids = cmds.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(cmds.filter((c) => c.group === "Story").length).toBe(CHAPTERS.length);
    expect(CHAPTERS.length).toBe(12);
    for (const s of SECTIONS) for (const [v] of s.views) expect(ids).toContain(`lab-${v}`);
    for (const c of COMPOUNDS) expect(ids).toContain(`compound-${c.key}`);
    expect(SECTIONS.flatMap((s) => s.views).length).toBe(16);
  });

  it("runs the right action", () => {
    const a = actions();
    const cmds = buildCommands(a);
    cmds.find((c) => c.id === "story-7")!.run();
    expect(a.goStory).toHaveBeenCalledWith(7);
    cmds.find((c) => c.id === "lab-validation")!.run();
    expect(a.goLab).toHaveBeenCalledWith("trust", "validation");
    cmds.find((c) => c.id === "compound-hepatotoxin")!.run();
    expect(a.setCompound).toHaveBeenCalledWith("hepatotoxin");
    cmds.find((c) => c.id === "present-8")!.run();
    expect(a.startPresenter).toHaveBeenCalledWith("8min");
  });

  it("offers exports only when there is data, and words toggles by their current state", () => {
    expect(buildCommands(actions({ hasData: false })).some((c) => c.group === "Export")).toBe(false);
    expect(buildCommands(actions()).filter((c) => c.group === "Export").length).toBe(3);
    expect(buildCommands(actions({ soundOn: true })).find((c) => c.id === "sound")!.title).toBe("Turn sound off");
    expect(buildCommands(actions({ cbOn: true })).find((c) => c.id === "cb")!.title).toMatch(/off/);
  });
});

describe("matching", () => {
  const cmds = buildCommands(actions());
  const top = (q: string) => filterCommands(q, cmds)[0]?.id;

  it("finds things by what people would type", () => {
    expect(top("kidney")).toBe("compound-nephrotoxin");
    expect(top("valid")).toBe("lab-validation");
    expect(top("humane")).toBeDefined();
    expect(top("dark")).toBe("theme-dark");
    expect(top("present 8")).toBe("present-8");
    expect(top("csv")).toBe("export-csv");
    expect(top("twin")).toBeDefined();
  });

  it("requires every word to match, ignores case and accents, and returns nothing for nonsense", () => {
    expect(filterCommands("zzzzqq", cmds)).toEqual([]);
    expect(filterCommands("THEME DARK", cmds)[0]!.id).toBe("theme-dark");
    expect(filterCommands("théme", cmds).length).toBeGreaterThan(0);
    expect(filterCommands("theme banana", cmds)).toEqual([]);
  });

  it("scores a title prefix above a mid-title match above a keyword match", () => {
    const base = { group: "g", keywords: "" };
    expect(score("rat", { ...base, title: "Rat model" })).toBeGreaterThan(score("rat", { ...base, title: "The rat model" }));
    expect(score("rat", { ...base, title: "The rat model" })).toBeGreaterThan(score("rat", { ...base, title: "Operation" }));
    expect(score("rat", { title: "Something", group: "g", keywords: "rat" })).toBeGreaterThan(0);
    expect(score("rat", { title: "Something", group: "g", keywords: "" })).toBe(0);
  });

  it("returns everything, in order, for an empty query, and respects the limit", () => {
    expect(filterCommands("", cmds)[0]!.id).toBe("story-0");
    expect(filterCommands("", cmds, 5).length).toBe(5);
  });

  it("does not choke on regular expression characters", () => {
    expect(() => filterCommands("(.*[", cmds)).not.toThrow();
  });
});
