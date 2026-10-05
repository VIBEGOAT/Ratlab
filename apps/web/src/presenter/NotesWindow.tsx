import { useEffect, useRef, useState } from "react";
import { TRACKS, secondsBefore, trackSeconds } from "./tracks";
import { PREDICT_ORGANS, totalVotes } from "./prediction";
import { openChannel, type Cmd, type Msg, type SyncState } from "./channel";
import { ORGAN_LABEL } from "../lib/setup";

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

/** The second-screen view: notes for this slide, what comes next, clocks, the room's tally and remote controls. */
export function NotesWindow() {
  const [st, setSt] = useState<SyncState | null>(null);
  const [lag, setLag] = useState(0);
  const chan = useRef<BroadcastChannel | null>(null);
  const received = useRef(0);

  useEffect(() => {
    document.title = "Speaker notes · ELIMINATE-Lab";
    const c = openChannel();
    chan.current = c;
    if (!c) return;
    c.onmessage = (ev: MessageEvent<Msg>) => { if (ev.data.type === "state") { received.current = performance.now(); setSt(ev.data.state); } };
    const ask = () => c.postMessage({ type: "hello" } satisfies Msg);
    ask();
    const t = window.setInterval(() => { setLag(performance.now() - received.current); if (performance.now() - received.current > 3000) ask(); }, 1000);
    return () => { window.clearInterval(t); c.close(); };
  }, []);

  const send = (cmd: Cmd) => chan.current?.postMessage({ type: "cmd", cmd } satisfies Msg);
  const connected = st !== null && lag < 4000;

  if (!st || !st.active) {
    return (
      <main className="notes-win" id="main">
        <h1>Speaker notes</h1>
        <p className="lede">{connected || st ? "The presentation is not running." : "Waiting for the main window. Keep it open in another window on this computer."}</p>
        <p className="muted">In the main window press <kbd>P</kbd> to present, or start a track from here.</p>
        <div className="notes-actions">
          <button className="primary" onClick={() => send("start3")}>Start the 3-minute demo</button>
          <button onClick={() => send("start8")}>Start the 8-minute demo</button>
        </div>
      </main>
    );
  }

  const track = TRACKS[st.track];
  const slide = track.slides[st.index]!;
  const nextSlide = track.slides[st.index + 1];
  const total = trackSeconds(st.track);
  const elapsed = secondsBefore(st.track, st.index) + Math.min(slide.seconds, st.slideElapsed);
  const ask = slide.kind === "ask" || slide.kind === "reveal";

  return (
    <main className="notes-win" id="main">
      <div className="notes-top">
        <span className="eyebrow">{track.label} · slide {st.index + 1} of {track.slides.length}</span>
        <span className="notes-clock" aria-label="Elapsed and planned time">{mmss(elapsed)} <span className="muted">/ {mmss(total)}</span></span>
      </div>
      <h1>{slide.title}</h1>
      <p className="notes-body">{slide.notes}</p>
      {ask && (
        <section className="notes-vote" aria-label="Audience prediction">
          <div className="eyebrow">Audience prediction {st.answer ? <>· answer: <b>{ORGAN_LABEL[st.answer]}</b> {st.revealed ? "(shown)" : "(hidden from the room)"}</> : null}</div>
          <div className="notes-bars">
            {PREDICT_ORGANS.map((o) => (
              <div key={o} className={st.answer === o ? "right" : ""}><span>{ORGAN_LABEL[o]}</span><b>{st.votes[o]}</b></div>
            ))}
          </div>
          <div className="small muted">{totalVotes(st.votes)} votes counted</div>
        </section>
      )}
      <div className="notes-next"><span className="eyebrow">Next</span> {nextSlide ? nextSlide.title : "End of the track"}</div>
      <div className="notes-actions">
        <button onClick={() => send("prev")}>Back</button>
        <button className="primary" onClick={() => send("next")}>Next</button>
        <button onClick={() => send("toggle")} aria-pressed={st.playing}>{st.playing ? "Pause auto-advance" : "Auto-advance"}</button>
        <button className="ghost" onClick={() => send("exit")}>End presentation</button>
      </div>
      {!connected && <p className="banner warn" role="status">Lost contact with the main window. Check that it is still open.</p>}
    </main>
  );
}
