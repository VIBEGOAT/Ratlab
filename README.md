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
Phase (b) done: 17-compartment PBPK (exact matrix-exponential propagation), RK45 solver, PD library, organ toxicodynamics with defence depletion, regeneration and adaptation, DDI and organ-feedback on clearance, six fictional archetypes, 82 tests.
Next: (c) disease overlays, untreated twin, behaviour.

Try it: `npx tsx scripts/explore.ts hepatotoxin 28` prints PK and damage versus dose.
