/** One damage scale for pathology grades 0 to 5, used in 3D, charts and badges. Values are CSS variables so themes and the colour-blind palette apply everywhere. */
export const GRADE_VAR = ["var(--g0)", "var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)", "var(--g5)"] as const;
export const GRADE_WORD = ["Healthy", "Minimal", "Mild", "Moderate", "Marked", "Severe"] as const;

/** Hex values for WebGL, which cannot read CSS variables. Kept in step with tokens in styles.css. */
export const GRADE_HEX = {
  standard: ["#39d3bb", "#a5d65a", "#f7d24a", "#ff7a45", "#ff3d5a", "#d63fd1"],
  cb: ["#4aa3df", "#8fc1e3", "#f5c26b", "#ef8a17", "#d55e00", "#8c2d04"],
} as const;

export function gradeVar(grade: number): string {
  return GRADE_VAR[Math.max(0, Math.min(5, Math.round(grade)))]!;
}
