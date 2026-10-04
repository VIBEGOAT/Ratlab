import type { Request, ResultOf, Response } from "./protocol";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (done: number, total: number) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function ensure(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<Response>) => {
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
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "Worker error"));
    pending.clear();
  };
  return worker;
}

type Payload<T extends Request["type"]> = Omit<Extract<Request, { type: T }>, "id" | "type">;

export function call<T extends Request["type"]>(type: T, payload: Payload<T>, onProgress?: (done: number, total: number) => void): Promise<ResultOf<T>> {
  const id = nextId++;
  return new Promise<ResultOf<T>>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    ensure().postMessage({ id, type, ...payload });
  });
}
