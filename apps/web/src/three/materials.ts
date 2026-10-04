import * as THREE from "three";

/**
 * Shared body shading. One GLSL deformation is used by the skin, every fur shell and the X-ray
 * shell, so all layers move together:
 *   - wasting thins the trunk (not the legs)
 *   - breathing swells the chest at the simulated respiration rate
 *   - hunch arches the back and lowers the head
 *   - walk swings the feet
 *   - tremor adds a fine, fast jitter
 */

export interface BodyUniforms {
  uTime: { value: number };
  uBreath: { value: number };
  uHunch: { value: number };
  uWaste: { value: number };
  uWalk: { value: number };
  uTremor: { value: number };
  uRuffle: { value: number };
  uSkinColor: { value: THREE.Color };
}

export function makeBodyUniforms(): BodyUniforms {
  return {
    uTime: { value: 0 }, uBreath: { value: 1.4 }, uHunch: { value: 0 }, uWaste: { value: 0 }, uWalk: { value: 0 },
    uTremor: { value: 0 }, uRuffle: { value: 0 }, uSkinColor: { value: new THREE.Color("#e8a9a2") },
  };
}

export const DEFORM_GLSL = /* glsl */ `
uniform float uTime; uniform float uBreath; uniform float uHunch; uniform float uWaste; uniform float uWalk; uniform float uTremor;
vec3 ratDeform(vec3 p) {
  float trunk = smoothstep(-1.75, -1.3, p.x) * (1.0 - smoothstep(1.35, 1.75, p.x));
  float lower = 1.0 - smoothstep(0.28, 0.55, p.y);
  float thin = 1.0 - 0.38 * uWaste * trunk * (1.0 - lower);
  p.y = 0.92 + (p.y - 0.92) * thin; p.z *= thin;
  float chest = smoothstep(0.1, 0.6, p.x) * (1.0 - smoothstep(1.2, 1.6, p.x)) * (1.0 - lower);
  float br = 1.0 + 0.028 * sin(6.2831853 * uBreath * uTime) * chest;
  p.y = 0.92 + (p.y - 0.92) * br; p.z *= br;
  float arch = exp(-pow((p.x + 0.2) / 0.9, 2.0)) * smoothstep(0.7, 1.3, p.y);
  p.y += uHunch * 0.18 * arch;
  float headW = smoothstep(1.35, 1.75, p.x);
  float ang = -0.32 * uHunch * headW;
  vec2 piv = vec2(1.45, 0.95); vec2 q = p.xy - piv;
  p.xy = piv + vec2(q.x * cos(ang) - q.y * sin(ang), q.x * sin(ang) + q.y * cos(ang));
  float legX = (1.0 - smoothstep(0.22, 0.38, abs(p.x - 1.2))) + (1.0 - smoothstep(0.3, 0.46, abs(p.x + 1.0)));
  float front = step(0.3, p.x);
  float phase = uTime * 7.0 + front * 3.14159 + step(0.0, p.z) * 3.14159;
  float foot = clamp((0.55 - p.y) / 0.55, 0.0, 1.0);
  p.x += legX * uWalk * 0.1 * sin(phase) * foot;
  p.y += legX * uWalk * 0.04 * max(0.0, cos(phase)) * foot;
  p += uTremor * 0.007 * vec3(sin(uTime * 71.0 + p.y * 30.0), sin(uTime * 83.0 + p.x * 25.0), sin(uTime * 67.0 + p.z * 28.0));
  return p;
}
`;

const HASH_GLSL = /* glsl */ `
float ratHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`;

/**
 * Skin and fur. `shell` is 0 for the base surface and 0 to 1 for fur shells. Areas with skinW
 * (paws, nose) show bare skin coloured by uSkinColor, which carries the jaundice tint.
 */
export function makeFurMaterial(u: BodyUniforms, furColor: THREE.Color, shell: number, furLength: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.92, metalness: 0, vertexColors: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uShell: { value: shell }, uFurLen: { value: furLength } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${DEFORM_GLSL}\n${HASH_GLSL}\nuniform float uShell; uniform float uFurLen; uniform float uRuffle; attribute float skinW; varying float vSkinW; varying vec3 vObj;`)
      .replace("#include <begin_vertex>", `vec3 transformed = ratDeform(vec3(position));
        vSkinW = skinW; vObj = position;
        float ruff = 1.0 + uRuffle * (ratHash(floor(position * 9.0)) * 2.0 - 0.4);
        transformed += normal * uShell * uFurLen * ruff * (1.0 - skinW);
        transformed.y -= uShell * uShell * uFurLen * 0.35 * (1.0 - uRuffle);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${HASH_GLSL}\nuniform float uShell; uniform vec3 uSkinColor; uniform float uRuffle; varying float vSkinW; varying vec3 vObj;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        if (uShell > 0.0) {
          if (vSkinW > 0.5) discard;
          float strand = ratHash(floor(vObj * 170.0));
          if (strand < uShell * (1.0 - 0.25 * uRuffle)) discard;
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, uSkinColor, vSkinW);
        diffuseColor.rgb *= mix(0.62, 1.05, uShell > 0.0 ? uShell : 0.15);`);
    // rim light for a soft, subsurface-like edge
    sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float rim = pow(1.0 - clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * rim * 0.22;`);
  };
  m.customProgramCacheKey = () => "rat-fur";
  return m;
}

/** X-ray shell: fresnel edge glow with near-transparent centre, so organs read clearly through the skin. */
export function makeXrayMaterial(u: BodyUniforms, color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uColor: { value: color } },
    vertexShader: `${DEFORM_GLSL}
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 p = ratDeform(position);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
        gl_FragColor = vec4(uColor, 0.035 + 0.75 * f);
      }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
}

/** Per-vertex bare-skin weight: paws, nose tip and the underside of the snout show skin, not fur. */
export function skinWeights(positions: Float32Array): Float32Array {
  const w = new Float32Array(positions.length / 3);
  for (let i = 0; i < w.length; i++) {
    const x = positions[i * 3]!, y = positions[i * 3 + 1]!;
    const paw = 1 - THREE.MathUtils.smoothstep(y, 0.07, 0.16);
    const nose = THREE.MathUtils.smoothstep(x, 2.82, 2.95);
    w[i] = Math.max(paw, nose);
  }
  return w;
}
