import { BODY_BOUNDS, ratSdf } from "./anatomy";
import { surfaceNets, type MeshData } from "./surfaceNets";

export interface BodyMeshData extends MeshData { skinW: Float32Array }

const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Per-vertex bare-skin weight: paws, nose tip and the underside of the snout show skin, not fur. */
export function skinWeightsOf(positions: Float32Array): Float32Array {
  const w = new Float32Array(positions.length / 3);
  for (let i = 0; i < w.length; i++) {
    const x = positions[i * 3]!, y = positions[i * 3 + 1]!;
    w[i] = Math.max(1 - smoothstep(y, 0.07, 0.16), smoothstep(x, 2.82, 2.95));
  }
  return w;
}

/** The one continuous rat body. Pure and three.js free, so it can run in a worker. About a second of work. */
export function computeBodyMesh(cell = 0.035): BodyMeshData {
  const m = surfaceNets((p) => ratSdf(p), BODY_BOUNDS.min, BODY_BOUNDS.max, cell);
  return { ...m, skinW: skinWeightsOf(m.positions) };
}
