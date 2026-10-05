/// <reference lib="webworker" />
import { computeBodyMesh } from "./bodyMesh";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = () => {
  const m = computeBodyMesh();
  ctx.postMessage(m, [m.positions.buffer, m.normals.buffer, m.indices.buffer, m.skinW.buffer]);
};
