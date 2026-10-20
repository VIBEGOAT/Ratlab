# VAST toxicity workbench

The app opens in **Toxicity** mode (`#toxicity` or the root route). Story is now explicitly `#story`; Lab and Learn remain available. No backend, credential, or external service is required.

## Workflow

Choose a fictional compound profile, daily dose, duration (7/14/28/90 days), recovery (0/7/14 days), oral or IV route, sex, and optional seed. Run the selected dose and a half-dose comparison with matched physiology. A dedicated cancellable worker lane keeps these runs separate from the exploratory Lab.

The model uses one virtual Sprague–Dawley rat, age 8 weeks, once-daily dosing, and no disease overlay. This is a controlled individual comparison, not a population estimate or statistical study. Recovery extends the simulation without adding doses. The core runs through the scheduled duration; modeled humane-endpoint signals do not establish an animal protocol.

Scrub through days and select organ cards. The injury trajectory and exposure curves connect response with dose and time. Plasma Cmax and AUC are over the entire experiment, including recovery; the PK chart offers full-run and first-24-hour views. Summaries use the 0.25 h solver grid; display curves are hourly and injury snapshots daily. Changing inputs leaves old results visibly labeled until another run completes. A canceled or failed run does not overwrite the previous result.

## Model coverage

The existing PBPK/toxicodynamics engine supports six injury systems: liver, kidney, heart, brain, gut, and marrow. Each compound profile activates only its parameterized mechanisms. Missing mechanisms are displayed as **Not modeled**, never as healthy or safe. Other tissue compartments support exposure calculations but not injury predictions. Injury grades are illustrative bins, not measured histopathology. The injury index is not the proportion of tissue destroyed or the probability of toxicity.

All compounds are fictional. This release does not add real-compound training data, validate the engine, calculate a regulatory NOAEL, or establish human safety. The tuned dose range is a demonstration range, not a validated applicability domain.

## HED calculator

The integrated calculator converts rat mg/kg to adult-human mg/kg using standard Km factors 6/37; human body weight converts that result to total mg. It updates to a changed selected-run dose, supports independent input, and includes an explicit button to use the selected dose again. It is arithmetic conversion, not an MRSD, safety recommendation, or exposure-equivalence model. Reference: FDA 2005 starting-dose guidance, Table 1.

## Export and verification

JSON exports contain the complete run settings, model version, both animal bundles, and organ responses at the selected day. CSV exports include hourly plasma and tissue concentrations, both doses, regimen, seed, sex, strain, and age. Exports always refer to the completed run, not changed-but-unrun inputs.

Unit tests cover input validation, recovery dose scheduling, matched physiology, reproducibility, different exposure across dose arms, and honest missing-mechanism reporting. Browser tests exercise the opening route, dose changes, recovery, day scrubbing, organ selection, HED, exports, cancellation/retry, accessibility, and mobile width.

## Learning interface

The default experience has three steps: explore the rat, compare exposure, and translate the dose. Basic setup shows compound, dose, and duration. Recovery, route, sex, and reproducibility settings are available under More options. On narrow screens, Edit experiment expands the setup so the rat stays visible without a long form above it.

The rat viewer uses the same completed `AnimalBundle` and selected day as the organ cards. The 3D scene supports surface/internal layers, direct organ selection, drag rotation, keyboard-accessible rotation/reset buttons, and optional illustrative motion. The organ map provides the same selection and results when WebGL is unavailable, a software renderer is detected, or a context is lost. Slow devices can opt into 3D explicitly. Reduced-motion settings stop ambient motion; the timeline advances only after Play. It stops when hidden, when changing steps, or when starting a run. 3D rendering pauses outside the viewport and while the document is hidden.

Charts and the body-surface-area calculator appear in their own steps. Editing settings keeps the completed results clearly labeled until a new run finishes. Simulation algorithms and injury coverage are unchanged. The shared style budget is 14 KiB gzipped; the production HTML remains within its existing 60 KiB limit.
