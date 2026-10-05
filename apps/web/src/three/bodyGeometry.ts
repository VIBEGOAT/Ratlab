import { useEffect, useState } from "react";
import * as THREE from "three";
import { computeBodyMesh, type BodyMeshData } from "./bodyMesh";

function toGeometry(m: BodyMeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute("skinW", new THREE.BufferAttribute(m.skinW, 1));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}

let cached: THREE.BufferGeometry | null = null;
let pending: Promise<THREE.BufferGeometry> | null = null;

/**
 * The shared body geometry, built off the main thread so the page stays responsive while it loads.
 * If a worker cannot be started it is built in place instead.
 */
export function loadBodyGeometry(): Promise<THREE.BufferGeometry> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = new Promise<THREE.BufferGeometry>((resolve) => {
      const inline = () => resolve(toGeometry(computeBodyMesh()));
      try {
        const w = new Worker(new URL("./bodyMesh.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (ev: MessageEvent<BodyMeshData>) => { w.terminate(); resolve(toGeometry(ev.data)); };
        w.onerror = () => { w.terminate(); inline(); };
        w.postMessage(0);
      } catch { inline(); }
    }).then((g) => (cached = g));
  }
  return pending;
}

/** The body geometry, or null until it is ready. */
export function useBodyGeometry(): THREE.BufferGeometry | null {
  const [g, setG] = useState<THREE.BufferGeometry | null>(cached);
  useEffect(() => {
    let live = true;
    if (!cached) void loadBodyGeometry().then((x) => { if (live) setG(x); });
    return () => { live = false; };
  }, []);
  return g;
}
