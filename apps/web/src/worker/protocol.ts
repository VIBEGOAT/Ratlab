import type {
  AnimalConfig, ForecastResult, HistoricalRow, MorrisResult, NoaelResult, Organ, StudyDesign, StudyResult, TwinBundle,
  EndpointRow, HistoRow, ValidationReport, Eligibility,
} from "@eliminate/sim-core";

export interface StudyPayload {
  study: StudyResult;
  rows: EndpointRow[];
  histo: HistoRow[];
  noael: NoaelResult;
}

export interface ValidationPayload {
  report: ValidationReport;
  eligibility: Eligibility | null;
  usedDemo: boolean;
}

export type Request =
  | { id: number; type: "study"; design: StudyDesign }
  | { id: number; type: "twin"; cfg: AnimalConfig }
  | { id: number; type: "forecast"; base: AnimalConfig; doses: number[]; n: number }
  | { id: number; type: "morris"; cfg: AnimalConfig; organ: Organ; r: number }
  | { id: number; type: "validation"; design: StudyDesign; nPerSex: number; historical: HistoricalRow[] };

export type Response =
  | { id: number; type: "progress"; done: number; total: number }
  | { id: number; type: "result"; payload: unknown }
  | { id: number; type: "error"; message: string };

export type ResultOf<T extends Request["type"]> = T extends "study" ? StudyPayload
  : T extends "twin" ? TwinBundle
  : T extends "forecast" ? ForecastResult[]
  : T extends "morris" ? MorrisResult[]
  : T extends "validation" ? ValidationPayload
  : never;
