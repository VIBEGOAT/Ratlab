import { useEffect } from "react";
import { constant } from "@eliminate/sim-core";
import { onSoundChange, setSoundPlan, soundIsOn, uiTick } from "./index";
import { soundPlan } from "./soundPlan";
import type { StoryPos } from "../story/useStoryScroll";

/** Drives the optional sound from the story's scroll position. Does nothing while sound is off. */
export function useStorySound(posRef: React.MutableRefObject<StoryPos>): void {
  useEffect(() => {
    let timer = 0, lastChapter = posRef.current.chapter;
    const bpm = constant("rat.heartRate.rest");
    const step = () => {
      const { chapter, progress } = posRef.current;
      if (chapter !== lastChapter) { lastChapter = chapter; uiTick(); }
      setSoundPlan(soundPlan(chapter, progress, bpm));
    };
    const start = () => { window.clearInterval(timer); timer = window.setInterval(step, 120); step(); };
    const stop = () => window.clearInterval(timer);
    if (soundIsOn()) start();
    const off = onSoundChange((on) => (on ? start() : stop()));
    // leaving the Story must not leave its bed or heartbeat playing in the Lab
    return () => { stop(); off(); setSoundPlan({ bed: 0, beat: 0, beatBpm: 60 }); };
  }, [posRef]);
}
