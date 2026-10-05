import type { Request, ResultOf, Response } from "./protocol";

/**
 * Worker RPC with lanes. Each lane is its own worker, so a long forecast never blocks a study re-run,
 * and a lane can be cancelled by terminating its worker (the only reliable way to stop a busy worker).
 */
export type Lane = "study" | "aux" | "pop";

type Pending = { lane: Lane; resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (done: number, total: number) => void };

export class CancelledError extends Error {
  constructor() { super("cancelled"); this.name = "CancelledError"; }
}

const workers = new Map<Lane, Worker>();
const pending = new Map<number, Pending>();
let nextId = 1;

function ensure(lane: Lane): Worker {
  const existing = workers.get(lane);
  if (existing) return existing;
  const w = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (ev: MessageEvent<Response>) => {
    const m = ev.data;
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === "progress") p.onProgress?.(m.done, m.total);
    else {
      pending.delete(m.id);
      if (m.type === "result") p.resolve(m.payload);
      else p.reject(new Error(m.message));
    }
  };
  w.onerror = (e) => {
    for (const [id, p] of pending) if (p.lane === lane) { p.reject(new Error(e.message || "Simulation worker failed")); pending.delete(id); }
    workers.delete(lane);
    w.terminate();
  };
  workers.set(lane, w);
  return w;
}

/** Stop everything running on a lane. Pending calls reject with CancelledError. */
export function cancelLane(lane: Lane): void {
  const w = workers.get(lane);
  if (!w) return;
  w.terminate();
  workers.delete(lane);
  for (const [id, p] of pending) if (p.lane === lane) { p.reject(new CancelledError()); pending.delete(id); }
}

type Payload<T extends Request["type"]> = Omit<Extract<Request, { type: T }>, "id" | "type">;

export function call<T extends Request["type"]>(type: T, payload: Payload<T>, onProgress?: (done: number, total: number) => void, lane: Lane = type === "study" || type === "twin" ? "study" : type === "population" ? "pop" : "aux"): Promise<ResultOf<T>> {
  const id = nextId++;
  return new Promise<ResultOf<T>>((resolve, reject) => {
    pending.set(id, { lane, resolve: resolve as (v: unknown) => void, reject, onProgress });
    ensure(lane).postMessage({ id, type, ...payload });
  });
}
