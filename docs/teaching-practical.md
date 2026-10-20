# VAST classroom: Practical 01

Open **Learn** in the top navigation (direct route `#learn`). The existing Story and exploratory Lab remain available. The practical runs locally in the browser and does not require the study worker, WebGL, an account, or external services.

## Intended use

A 35–45 minute undergraduate biotechnology, physiology, or introductory pharmacology activity on dose, concentration, exposure, clearance, and repeated dosing. Suggested timing is a design estimate; it has not been evaluated with students.

The lesson uses a separate, explicitly fictional one-compartment oral model, not the exploratory Lab's PBPK/toxicity engine. Parameters are selected for teaching, not measured from rats. Software tests establish mathematical behavior, not biological validity or teaching effectiveness.

## Learning sequence

1. Predict the effect of doubling dose on AUC, run the controlled comparison, and explain proportionality under linear kinetics.
2. Predict the effect of halving clearance on elimination half-life. Distinguish finite-window AUC from AUC to infinity.
3. Shorten the dosing interval without changing dose per administration. Explain why dose rate increases while elimination half-life stays fixed.
4. Complete four formative questions, including transfer to a new distribution-volume scenario.

The initial prediction is retained even when wrong. Reflections are not automatically graded. The instructor guide and answers are openly accessible: this is formative practice, not a secure examination system.

## Reproducibility and formulas

Version: `vast-teaching-pk-1`. Fixed F = 0.8, V = 1 L/kg, ka = 1/h. Baseline dose = 10 mg/kg, clearance = 0.2 L/h/kg. Oral input uses the analytic Bateman function and linear superposition. An equal-rate limiting expression handles ka = CL/V. AUC over 0–72 h is integrated analytically. Peak is sampled every 0.1 h and labeled accordingly. Doses at 72 h are excluded. Steady-state average is theoretical, assuming indefinitely continued dosing.

No variability, saturation, metabolites, organ injury, or safety threshold is represented. See the in-app model glossary for equations and the Kuepfer et al. (2016) model-building reference. That reference is background, not a source of these fictional parameters.

## Student and instructor materials

- Export the notebook as standalone HTML; open and print or save as PDF.
- Export concentration-time curves as CSV with units, regimen inputs, fixed parameters, and model version.
- Download a blank worksheet from the instructor section.
- Instructor guide: pacing, expected relationships, discussion prompts, and a suggested 0–2 reflection rubric are available in-app.
- Local browser storage retains predictions, reflections, and quiz answers. There is no submission server, roster, or cross-device sync. Students should export and clear work on shared computers. A storage failure leaves the lesson usable and displays an export reminder.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test -w @eliminate/web`, and `npm run build` from the repository root. From `apps/web`, run `npx playwright test e2e/learn.spec.ts` with installed Chromium (the cloud's external Playwright configuration selects system Chromium).

Tests cover known PK relationships, independent numerical integration, dose timing, invalid inputs, malformed persisted records, escaped report content, full learning workflow, download events, reload persistence, shared-device reset, navigation, mobile width, and an automated axe scan.

## Next evidence milestone

Review the lesson's scientific and instructional content with an educator, then evaluate task completion and misconceptions with learners under appropriate institutional procedures. Do not claim improved learning or reduced actual animal use until measured. Future practicals should be added as complete learning units, not merely more simulation controls.
