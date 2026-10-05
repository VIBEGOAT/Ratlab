# Quality gates

What is measured, how, what the numbers were, and what they do not show. Everything here can be re-run; nothing is estimated by hand.

## Targets and results

| Gate | Target | Result |
|---|---|---|
| Lighthouse performance, desktop | 90 or more | 94 to 99 (96 with live 3D on the last run, 99 without) |
| Lighthouse accessibility | 95 or more | 100 on every page tested |
| Lighthouse best practices | 95 or more | 100 |
| Lighthouse SEO | (not set) | 100 |
| Lighthouse performance, mobile | (not set) | 84, below 90. See "Mobile" below |
| axe-core (WCAG 2.2 AA and best practice) | no violations | none, in 9 test groups (see below) |
| Unit tests | all pass | 199 simulation + 67 interface |
| End-to-end tests (Playwright) | all pass | 53 of 53 (16 minutes for the full run) |
| Visual regression | no unexpected change | 15 screenshots at 3 sizes |
| Entry JavaScript | 170 kB gzip or less | 111.7 kB |
| Lint | no errors | none |

## Lighthouse

Method: `npm run build`, `vite preview`, then `bash scripts/lighthouse-all.sh` (Lighthouse 12.x through npx, headless Chrome with the machine's real GPU, an Intel UHD integrated graphics chip, on a Windows laptop). Reports are in `docs/lighthouse/*.json`; open a JSON and read `categories` and `audits`. Scores move by a few points from run to run; the table is the last run.

| Page | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Story, live 3D, desktop | 96 | 100 | 100 | 100 | 0.4 s | 0.8 s | 160 ms | 0.009 |
| Story, `?3d=0`, desktop | 99 | 100 | 100 | 100 | 0.4 s | 0.9 s | 0 ms | 0.009 |
| Lab (PK/PD), desktop | 99 | 100 | 100 | 100 | 0.4 s | 1.0 s | 0 ms | 0.009 |
| Story, live 3D, mobile | 84 | 100 | 100 | 100 | 1.7 s | 4.4 s | 30 ms | 0.011 |
| Story, `?3d=0`, mobile | 84 | 100 | 100 | 100 | 1.7 s | 4.4 s | 90 ms | 0.011 |

The `?3d=0` link opens the page without the live 3D scene. It exists so the cost of the app itself can be measured apart from the 3D scene, and so a slow machine can be given a light version.

### What changed to get here

The first measurement of the production build was performance 66 (blocking time 1.85 s), accessibility 95, best practices 96, SEO 91. The fixes, in order of effect:

1. **3D scene start-up (about 1.2 s of blocking).** The rat body (a signed-distance-field mesh) is now built in a Web Worker instead of the page's main thread. Shaders are compiled in parallel (`compileAsync`) before the first frame, with a placeholder body so the fur shaders compile early, and three.js is told not to stall on each shader link in production builds. Auto quality starts light and rises to high once frames are steady (it never rises again after a slow patch). The WebGL probe, which starts the GPU process, waits until the page is idle.
2. **The 3D engine left the entry bundle.** The Story imported the 3D code statically, so every visitor downloaded about 1 MB (uncompressed) of three.js before the page could start. Entry JavaScript went from 437 kB to 112 kB gzipped. The Framer Motion dependency (used for a count-up, a button press and a reduced-motion check) was replaced with 30 lines and CSS.
3. **Fonts and first paint.** Geist is self-hosted (the page used to request Google-hosted fonts that were not the ones its design named). The stylesheet and the Latin font are inlined into the HTML, and the hero is present in the HTML before any script runs, with the same classes as the app, so layout shift is 0.009.
4. **Hygiene found by Lighthouse:** a missing favicon (a 404 in the console), no `robots.txt`, no source maps for first-party code, table markup with `role="row"` and no cells, and accessible names that did not start with the visible text.

On phones and tablets the live 3D scene starts on the first touch or scroll instead of automatically, and on a computer that renders WebGL on the CPU the page shows a still picture with a "Turn on 3D" button.

### Mobile

Lighthouse's default mobile profile simulates a slow 4G connection (1.6 Mbit/s, 150 ms round trip) and a 4x slower CPU. Under it the page scores 84. The observed (unsimulated) timings in the same run are a first paint at about 0.1 s and the largest paint at about 0.3 s; the simulated 4.4 s largest-paint comes from the model re-timing the JavaScript download and the React render on the slowed CPU. I stopped optimising here rather than chase the score: the remaining step would be server-side rendering the hero, which is a larger change than this phase.

### What these numbers do not show

- **Only one GPU was measured.** The live-3D numbers are for an Intel UHD integrated chip. There is no 60 fps measurement on other laptops, and none on a phone.
- **Lighthouse does not interact.** It does not scroll the Story, run the thousand-rat simulation, or open the Lab views. The Lab PK/PD page was measured once, loaded directly.
- **The simulation is not in these figures.** A first visit uses a pre-baked study, so the page is ready at once. Changing the setup runs the real simulation in a worker (tens of seconds to a couple of minutes depending on the machine, then cached).

## Accessibility

`apps/web/e2e/a11y.spec.ts` runs axe-core (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice) and fails on any violation. It covers:

- the Story in light, dark and the colour-blind palette, and six chapters with live data;
- all five Lab sections in light and dark, and every one of the sixteen Lab views;
- the command palette, the honesty drawer, presenter mode (question and answer slides) and the speaker-notes window.

Fixes this pass found: the light-theme teal, amber and orange were a little under 4.5:1 contrast (the teal was 3.9 to 4.3), a missing level-one heading in the Lab, scrollable tables that keyboard users could not reach, empty table headers, an invalid dialog role, the presenter controls outside any landmark, and grade colours used as text in the colour-blind palette (now a coloured border and dot, with the grade in normal text).

Automated checks find roughly a third of accessibility problems. What they cannot judge is covered by behaviour tests (palette focus handling, chart keyboard reading, presenter keys) and still needs a person using a screen reader. That has not been done.

## Visual regression

`apps/web/e2e/visual.spec.ts` takes 15 screenshots: the Story hero (light and dark), Lab design, Lab PK/PD with labelled charts and the command palette, each at 1440x900, 1920x1080 and 390x844. The 3D scene is off in these (software-rendered WebGL is not pixel-stable). The baselines are Windows renderings in `e2e/visual.spec.ts-snapshots`; on another operating system, regenerate them first. The continuous-integration workflow therefore skips snapshot comparison.

## Bundle size

`npm run bundle` builds, then enforces budgets and writes `docs/bundle-report.md` (every file with raw and gzip size). Budgets: entry JavaScript 170 kB gzip, any lazy chunk 260 kB, style rules 12 kB, page HTML 60 kB, simulation worker 120 kB.

## Lint

ESLint 9 with typescript-eslint, react-hooks and jsx-a11y. A few files carry a documented exception for the custom widgets that the accessibility rules cannot recognise (the keyboard-readable chart, dialog backdrops, the focusable tooltip trigger, scrollable regions); each states its reason at the top. Diagnostic scripts in `scripts/` are exempt from the stricter rules.

## Not done

- A screen-reader pass by a person, and a colour-vision-deficiency review of the thousand-rat dot field.
- Real-GPU frame-rate measurement on a range of laptops and phones.
- Server-side rendering of the hero, which would lift the mobile score.
