/** Plain-language names for the study's measured endpoints and for the adverse-finding notes the analysis writes. */

const NAMES: Record<string, string> = {
  bodyWeightG: "Body weight",
  bodyWeightChangePct: "Body-weight gain",
  foodGPerDay: "Food intake",
  waterMlPerDay: "Water intake",
  sicknessIndex: "Sickness index",
  grimaceScore: "Grimace (pain) score",
  tumorVolumeMm3: "Tumour volume",
  "chem.alt": "ALT (liver enzyme)",
  "chem.ast": "AST (liver and muscle enzyme)",
  "chem.alp": "ALP (liver and bone enzyme)",
  "chem.ggt": "GGT (bile-duct enzyme)",
  "chem.bilirubin": "Bilirubin",
  "chem.albumin": "Albumin",
  "chem.bun": "Urea nitrogen (kidney)",
  "chem.creatinine": "Creatinine (kidney)",
  "chem.troponinI": "Troponin I (heart damage)",
  "chem.ck": "CK (muscle enzyme)",
  "chem.glucose": "Glucose",
  "chem.cholesterol": "Cholesterol",
  "chem.triglycerides": "Triglycerides",
  "chem.sodium": "Sodium",
  "chem.potassium": "Potassium",
  "chem.chloride": "Chloride",
  "chem.calcium": "Calcium",
  "chem.phosphorus": "Phosphorus",
  "heme.rbc": "Red blood cells",
  "heme.hemoglobin": "Haemoglobin",
  "heme.hematocrit": "Haematocrit",
  "heme.wbc": "White blood cells",
  "heme.neutrophils": "Neutrophils",
  "heme.lymphocytes": "Lymphocytes",
  "heme.platelets": "Platelets",
  "heme.reticulocytes": "Reticulocytes (young red cells)",
};

const ORGAN_WORD: Record<string, string> = { liver: "Liver", kidney: "Kidney", heart: "Heart", brain: "Brain", spleen: "Spleen", gut: "Gut", marrow: "Bone marrow" };

/** "chem.troponinI" becomes "Troponin I (heart damage)". Unknown keys are turned into words rather than shown raw. */
export function endpointLabel(key: string): string {
  const known = NAMES[key];
  if (known) return known;
  const organ = /^organ\.(\w+)\.(relative|absolute)$/.exec(key);
  if (organ) return `${ORGAN_WORD[organ[1]!] ?? organ[1]} weight${organ[2] === "relative" ? " (relative to body)" : ""}`;
  const histo = /^histo\.(\w+)\.grade$/.exec(key);
  if (histo) return `${ORGAN_WORD[histo[1]!] ?? histo[1]} damage under the microscope`;
  const tail = key.split(".").pop() ?? key;
  const words = tail.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A bare blood-panel key such as "alt" or "rbc". */
export function markerLabel(key: string): string {
  return NAMES[`chem.${key}`] ?? NAMES[`heme.${key}`] ?? endpointLabel(key);
}

const SEX: Record<string, string> = { M: "males", F: "females" };

/**
 * The analysis writes notes such as "chem.ast (M) +416%" or "histopathology heart (F) grade 2+ in 6/10".
 * This turns them into "AST (liver and muscle enzyme) in males, up 416%". Anything else passes through unchanged.
 */
export function readableFinding(note: string): string {
  const change = /^(\S+) \((M|F)\) ([+-])(\d+)%$/.exec(note);
  if (change) return `${endpointLabel(change[1]!)} in ${SEX[change[2]!]}, ${change[3] === "+" ? "up" : "down"} ${change[4]}%`;
  const histo = /^histopathology (\w+) \((M|F)\) grade 2\+ in (\d+)\/(\d+)$/.exec(note);
  if (histo) return `${ORGAN_WORD[histo[1]!] ?? histo[1]} damage (grade 2 or worse) in ${histo[3]} of ${histo[4]} ${SEX[histo[2]!]}`;
  const humane = /^humane endpoints in (\d+)\/(\d+)$/.exec(note);
  if (humane) return `Humane endpoint reached by ${humane[1]} of ${humane[2]} animals`;
  return note;
}
