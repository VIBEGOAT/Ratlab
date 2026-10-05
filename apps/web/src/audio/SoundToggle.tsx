import { useEffect, useState } from "react";
import { disableSound, enableSound, onSoundChange, soundIsOn, uiTick } from "./index";

/** Off by default. Turning it on is the viewer's choice, and it loads the audio code only then. */
export function SoundToggle({ className = "ghost" }: { className?: string }) {
  const [on, setOn] = useState(soundIsOn());
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => onSoundChange(setOn), []);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      title={unavailable ? "Sound is not available in this browser" : "Quiet interface ticks, and a soft heartbeat during the toxicity chapters"}
      onClick={async () => {
        if (on) { disableSound(); return; }
        const ok = await enableSound();
        setUnavailable(!ok);
        if (ok) uiTick();
      }}
    >
      {unavailable ? "Sound unavailable" : on ? "Sound on" : "Sound off"}
    </button>
  );
}
