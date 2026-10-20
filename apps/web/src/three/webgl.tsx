import { Component, useEffect, type ReactNode } from "react";

/** Small WebGL helpers with no 3D imports, so the main bundle can use them without pulling in three.js. */
let probed: { ok: boolean; renderer: string } | null = null;

/** True for CPU-based renderers (SwiftShader, llvmpipe, Microsoft Basic Render Driver), where live 3D runs far too slowly. */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer);
}

function probe(): { ok: boolean; renderer: string } {
  if (probed) return probed;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    let renderer = "";
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    probed = { ok: !!gl, renderer };
  } catch { probed = { ok: false, renderer: "" }; }
  return probed;
}

/** Whether WebGL can run. The probe creates a throwaway context, which is slow on software renderers, so it runs once. */
export function webglAvailable(): boolean {
  try {
    // an explicit opt-out for very slow graphics (and for tests that do not need 3D)
    if (localStorage.getItem("no3d") === "1") return false;
  } catch { return false; }
  // a link ending in ?3d=0 opens the lightweight version, without the live 3D scene
  if (typeof location !== "undefined" && new URLSearchParams(location.search).get("3d") === "0") return false;
  return probe().ok;
}

/** True when the browser is rendering WebGL on the CPU and the viewer has not chosen to turn 3D on anyway. */
export function softwareGraphics(): boolean {
  try { if (localStorage.getItem("force3d") === "1") return false; } catch { /* storage may be blocked */ }
  return probe().ok && isSoftwareRenderer(probe().renderer);
}

export function force3d(): void {
  try { localStorage.setItem("force3d", "1"); } catch { /* storage may be blocked */ }
}

/** Some browsers do not report the first layout of a freshly mounted canvas. Ask for one more measurement. */
export function useKickResize(dep: unknown): void {
  useEffect(() => {
    const ids = [60, 300, 900].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event("resize")), ms));
    return () => ids.forEach((i) => window.clearTimeout(i));
  }, [dep]);
}

export class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError?: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(e: unknown) { console.error("3D scene failed", e); this.props.onError?.(); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Canvas onCreated handler. In production builds three.js is told not to wait on each shader link to check for errors,
 * which lets the driver compile in parallel instead of stalling the first frames (about 0.6 s here). Development keeps
 * the checks so shader mistakes still show up.
 */
export function fastShaders({ gl }: { gl: { debug: { checkShaderErrors: boolean } } }): void {
  if (import.meta.env.PROD) gl.debug.checkShaderErrors = false;
}
