/**
 * Naive surface nets: turns a signed distance field into one smooth, closed triangle mesh.
 * One vertex per grid cell that the surface crosses (the mean of its edge crossings), one quad
 * per grid edge with a sign change. Normals come from the field gradient, so shading is smooth.
 * Pure function, no three.js, so it can be tested and run anywhere.
 */
import type { Vec3 } from "./anatomy";

export interface MeshData { positions: Float32Array; normals: Float32Array; indices: Uint32Array }

export function surfaceNets(sdf: (p: Vec3) => number, min: Vec3, max: Vec3, cell: number): MeshData {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const field = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    field[at(i, j, k)] = sdf([min[0] + i * cell, min[1] + j * cell, min[2] + k * cell]);

  const vertIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellAt = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corners: Array<[number, number, number]> = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges: Array<[number, number]> = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);

  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const [a, b, d] = corners[c]!;
      v[c] = field[at(i + a, j + b, k + d)]!;
      if (v[c]! < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of edges) {
      const a = v[e0]!, b = v[e1]!;
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      const c0 = corners[e0]!, c1 = corners[e1]!;
      sx += c0[0] + (c1[0] - c0[0]) * t;
      sy += c0[1] + (c1[1] - c0[1]) * t;
      sz += c0[2] + (c1[2] - c0[2]) * t;
      n++;
    }
    vertIndex[cellAt(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
  }

  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = field[at(i, j, k)]! < 0;
    // edge along x from (i,j,k) to (i+1,j,k)
    if (i < nx - 1 && s0 !== (field[at(i + 1, j, k)]! < 0)) quad(vertIndex[cellAt(i, j - 1, k - 1)]!, vertIndex[cellAt(i, j, k - 1)]!, vertIndex[cellAt(i, j, k)]!, vertIndex[cellAt(i, j - 1, k)]!, !s0);
    if (j < ny - 1 && s0 !== (field[at(i, j + 1, k)]! < 0)) quad(vertIndex[cellAt(i - 1, j, k - 1)]!, vertIndex[cellAt(i - 1, j, k)]!, vertIndex[cellAt(i, j, k)]!, vertIndex[cellAt(i, j, k - 1)]!, !s0);
    if (k < nz - 1 && s0 !== (field[at(i, j, k + 1)]! < 0)) quad(vertIndex[cellAt(i - 1, j - 1, k)]!, vertIndex[cellAt(i, j - 1, k)]!, vertIndex[cellAt(i, j, k)]!, vertIndex[cellAt(i - 1, j, k)]!, !s0);
  }

  const positions = new Float32Array(pos);
  const normals = new Float32Array(pos.length);
  const e = cell * 0.5;
  for (let p = 0; p < positions.length; p += 3) {
    const x = positions[p]!, y = positions[p + 1]!, z = positions[p + 2]!;
    const gx = sdf([x + e, y, z]) - sdf([x - e, y, z]);
    const gy = sdf([x, y + e, z]) - sdf([x, y - e, z]);
    const gz = sdf([x, y, z + e]) - sdf([x, y, z - e]);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[p] = gx / l; normals[p + 1] = gy / l; normals[p + 2] = gz / l;
  }
  return { positions, normals, indices: new Uint32Array(idx) };
}

/** Number of connected components, used by tests to prove the body is a single piece. */
export function connectedComponents(m: MeshData): number {
  const n = m.positions.length / 3;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = find(m.indices[t]!), b = find(m.indices[t + 1]!), c = find(m.indices[t + 2]!);
    parent[b] = a; parent[find(c)] = a;
  }
  const roots = new Set<number>();
  const used = new Set<number>(m.indices);
  for (const i of used) roots.add(find(i));
  return roots.size;
}
