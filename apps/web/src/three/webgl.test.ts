import { describe, it, expect } from "vitest";
import { isSoftwareRenderer } from "./webgl";

describe("software renderer detection", () => {
  it("recognises CPU renderers", () => {
    for (const r of ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)", "llvmpipe (LLVM 15.0.7, 256 bits)", "Microsoft Basic Render Driver", "Mesa Software Rasterizer"]) expect(isSoftwareRenderer(r)).toBe(true);
  });
  it("does not flag real GPUs or an unknown renderer", () => {
    for (const r of ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", "Apple M2", "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)", ""]) expect(isSoftwareRenderer(r)).toBe(false);
  });
});
