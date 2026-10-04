# ELIMINATE-Lab (working name)

In-silico rat study simulator aimed at replacing, reducing and refining animal testing (3Rs).

**Research and education tool. Not validated for regulatory or safety decisions.**

## Layout
- `data/reference.json` all numeric constants, each with source, confidence and VERIFIED or UNVERIFIED status
- `data/references.json` bibliography with verification status
- `data/needs-expert-check.md` generated list of everything still unverified (`npm run gen:needs`)
- `packages/sim-core` pure TypeScript simulation library (seeded, deterministic, no UI imports)
- `apps/web` added in phase (e)

## Commands
- `npm run ci` regenerate review file, type-check, run tests

## Status
Phase (a) done: seeded forkable RNG, reference data schema and validator, fidelity registry, tests.
Next: (b) PBPK, PD and toxicodynamics.
