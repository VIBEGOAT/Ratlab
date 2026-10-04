# Expert review checklist

Each reviewer should record: name, date, simulator version, what was reviewed, findings, and sign-off or objections. Items marked **blocking** must be resolved before any use beyond teaching and demonstration.

## Toxicologist
- [ ] Replace placeholder reference ranges (clinical chemistry, haematology) with vendor historical control data for the intended strain, sex and age. **blocking**
- [ ] Review the damage-to-biomarker mapping in `observables.ts` (ALT, AST, bilirubin, BUN, creatinine, troponin, neutrophils and the rest). **blocking**
- [ ] Set the adversity thresholds in `analysis.ts`: relevance percentages, minimum effect size (1.5), strong effect size (3), corroboration rule. **blocking**
- [ ] Review the NOAEL, LOAEL and MTD logic against how your organisation defines them.
- [ ] Check the archetype compound behaviour is a fair caricature of each toxicity type (hepatic, renal, cardiac, neuro, myelo).
- [ ] Confirm the OECD TG 407 and TG 408 design details, especially TG 408 group sizes (currently UNVERIFIED).
- [ ] Review Hy's Law thresholds and how they are applied to rat data.

## Pathologist
- [ ] Review the finding names per organ and grade (`FINDINGS` in `toxicodynamics.ts`) and the 0 to 5 grade cut points. **blocking**
- [ ] Confirm which organs, lesions and distributions a real study would report that are missing here (for example lung, thymus, adrenals, reproductive organs).
- [ ] Review the gross necropsy and organ-weight logic in `observables.ts`.

## Pharmacokineticist
- [ ] Verify the rat physiology tables against Brown et al. 1997 and Davies and Morris 1993, and resolve the cardiac output discrepancy (about 5 L/h from the allometric formula against 3.3 L/h from the cited table). **blocking**
- [ ] Review the PBPK structure (flow-limited tissues, single arterial and venous pools, first-order absorption). Saturable metabolism and transporters are not modelled.
- [ ] Compare a few reference compounds with an independent platform such as PK-Sim.
- [ ] Review the effect-compartment and indirect-response parameters used by the archetypes.

## Behavioural neuroscientist
- [ ] Review every behavioural mapping in `behaviour.ts` and the claims in the interface. All of it is ILLUSTRATIVE. **blocking**
- [ ] Check the observation battery items, scoring and baselines. The Irwin screen was described for the mouse, and Moser's battery for the rat.
- [ ] Confirm the tolerance and withdrawal-rebound logic is reasonable for CNS-active compounds.
- [ ] Decide which behavioural endpoints, if any, are worth calibrating to real tracking data first.

## Biostatistician
- [ ] Review the Dunnett implementation (numerical integration) and its tests, and cross-check critical values with R multcomp or SAS. **blocking**
- [ ] Review the Kruskal-Wallis, Dunn, Holm, trend, Fisher, Kaplan-Meier and log-rank implementations.
- [ ] Decide the rule for choosing parametric against non-parametric tests (currently a skewness check).
- [ ] Review multiplicity handling across the many endpoints.
- [ ] Review the validation harness pass criteria (two historical SDs, SD ratio between 0.5 and 2).
- [ ] Review how virtual control eligibility is defined, and the Monte Carlo sample sizes.

## Regulatory affairs
- [ ] Define the context of use for any intended application and record it in the credibility tab. **blocking**
- [ ] Check how FDA Modernization Act 2.0 and the FDA 2025 roadmap apply to the intended use. Neither obliges any agency to accept a given method.
- [ ] Review the V&V 40 style credibility factors and the evidence level the risk requires. V&V 40 was written for medical devices.
- [ ] Check whether the use needs agreement with a regulator, and what data package that would need.
- [ ] Review the humane endpoint criteria against institutional policy and OECD GD 19.
- [ ] Check licences before loading any third-party dataset.

## Software and data
- [ ] Independent code review of `packages/sim-core`.
- [ ] Review `data/needs-expert-check.md` line by line. Each unverified constant needs a source or a replacement.
- [ ] Decide on a governance process for changing model parameters, with versioned results.
