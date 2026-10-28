# Story rebuild and verification

## Root cause (reproduced before editing)

The document (`HTML`) was the real vertical scroller; no second vertical scroller was found in Story.
Lenis smoothed window scrolling, while the cinematic hero advanced from its own React Three Fiber frame clock.
Later scenes read a different chapter-local scroll measurement, and their camera also used elapsed time.
The layout mixed viewport-height chapters, four nested sticky cards, a separately sticky canvas, and a fixed overlay with different offsets.
With `scrollY = 0`, the hero changed from Meadow to Organs during a nine-second idle observation.

Before this rebuild, `#story` was a route fragment, not a DOM section ID: the rendered root was `main.story#main`.

## Pre-change audit

Measured in Chromium at 1440 × 900. All matching nodes below are listed in DOM order, including repeated elements. SVG overflow and native input clipping do not create a user-scrollable container. All inspected nodes had `will-change: auto`.

| # | Element | Overflow | Position | Computed height | Transform | Will-change |
|---|---|---|---|---|---|---|
| 1 | `HTML.lenis.mouse-cursor-on` | visible | static | 900px | `none` | auto |
| 2 | `BODY.` | visible | static | 900px | `none` | auto |
| 3 | `SPAN#spared-assumptions.card` | visible | absolute | 143px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 4 | `svg` | hidden | static | 240px | `none` | auto |
| 5 | `DIV.sticky-block` | visible | sticky | 313.312px | `none` | auto |
| 6 | `DIV.sticky-block` | visible | sticky | 545.797px | `none` | auto |
| 7 | `svg` | hidden | static | 30px | `none` | auto |
| 8 | `svg` | hidden | static | 30px | `none` | auto |
| 9 | `svg` | hidden | static | 30px | `none` | auto |
| 10 | `svg` | hidden | static | 30px | `none` | auto |
| 11 | `H2#c5.sr-only` | hidden | absolute | 1px | `none` | auto |
| 12 | `SPAN.sr-only` | hidden | absolute | 1px | `none` | auto |
| 13 | `SPAN.sr-only` | hidden | absolute | 1px | `none` | auto |
| 14 | `DIV.sticky-block` | visible | sticky | 748.656px | `none` | auto |
| 15 | `DIV.segmented` | auto | static | 38px | `none` | auto |
| 16 | `g` | visible | static | auto | `matrix(1, 0, 0, 1, 42, 24)` | auto |
| 17 | `SPAN.sr-only` | hidden | absolute | 1px | `none` | auto |
| 18 | `SPAN.card` | visible | absolute | 84.5px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 19 | `SPAN.sr-only` | hidden | absolute | 1px | `none` | auto |
| 20 | `DIV.sticky-block` | visible | sticky | 340.25px | `none` | auto |
| 21 | `SPAN.card` | visible | absolute | 84.5px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 22 | `SPAN.card` | visible | absolute | 143px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 23 | `SPAN.card` | visible | absolute | 123.5px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 24 | `SPAN.card` | visible | absolute | 104px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 25 | `SPAN.card` | visible | absolute | 84.5px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 26 | `SPAN.card` | visible | absolute | 143px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 27 | `SPAN.card` | visible | absolute | 84.5px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 28 | `SPAN.card` | visible | absolute | 104px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 29 | `SPAN.card` | visible | absolute | 84.5px | `matrix(1, 0, 0, 1, 0, -4)` | auto |
| 30 | `INPUT#sp-studies.` | clip | static | 39px | `none` | auto |
| 31 | `INPUT#sp-groups.` | clip | static | 39px | `none` | auto |
| 32 | `INPUT#sp-n.` | clip | static | 39px | `none` | auto |
| 33 | `INPUT#sp-screen.` | clip | static | 39px | `none` | auto |
| 34 | `INPUT#sp-vcg.` | clip | static | 39px | `none` | auto |
| 35 | `DIV.story-stage` | visible | sticky | 813px | `none` | auto |
| 36 | `DIV.cinematic-hero` | hidden | absolute | 813px | `none` | auto |
| 37 | `DIV.` | hidden | relative | 813px | `none` | auto |
| 38 | `CANVAS.` | clip | static | 813px | `none` | auto |
| 39 | `DIV.moment` | visible | fixed | 900px | `none` | auto |

Ancestors `#root`, `.app`, and `main.story#main` had ordinary flow positioning, visible overflow, and no transform or will-change. HTML/body's 900px computed height came from the viewport-height root sizing; document content reached 16,513px. The shell's sticky `.topbar` was a sibling, not a Story ancestor.

Source rules additionally used `.chapter-sec { min-height:105vh }`, tall chapters at 190vh (290vh on phones), `.moment-sec { min-height:280vh }`, and `.finale { min-height:120vh }`. The scene used `calc(100vh - 53px - 34px)`; its mobile rule used 42vh. Sticky text had its own 80px or `calc(42vh + 62px)` top offset.

Original animation drivers:
- `StoryPage.tsx`: Lenis with `lerp:0.09`, smooth wheel handling, and a continuous rAF loop.
- `CinematicHero.tsx`: `clock.current += dt` in `useFrame`, driving the hero cycle, camera, gait, grass, organ tour and particles independently of scroll.
- `useStoryScroll.ts`: another scroll listener selected chapters by the viewport midpoint, with React state quantized to 1% changes.
- `StoryScene.tsx`: additional frame-clock camera/scene animation.

## Diff summary

- Replaced the old 12-chapter Story with six connected teaching stations in `StoryPage.tsx`.
- Added `journey.ts` for deterministic chapter/pose/path mapping and explicitly fictional teaching equations.
- Added `useJourney.ts`: one passive window scroll listener, one queued rAF measurement, immediate initial/hash navigation, and debounced ResizeObserver updates.
- Added a 600dvh section with one 100dvh sticky stage. Desktop has two columns; phones have a scene strip above the text; short landscape screens use compact side-by-side content.
- Inline SVG rig follows `getPointAtLength` and its tangent. Gait, heart pulse, PK reveal, chapter entry and progress use scroll progress. Reduced motion uses stationary chapter states.
- Compound and dose inputs are shared across all six widgets. HED uses adult reference Km factors (rat 6, human 37); the response midpoint is explicitly not a safety threshold.
- Removed Lenis and the WebGL cinema from the Story render path. Legacy 3D source remains available in the repository; the Lab retains its 3D model.
- Removed obsolete Story CSS and background simulation prewarming from this route. No new runtime libraries.
- Updated chapter search and presenter tracks. Presenter navigation jumps to a station; it no longer drags the page on a timer. Removed the obsolete 12-chapter audience-quiz overlays. Optional presenter auto-advance still requires explicit activation.
- Added an HTML loading skeleton. SVG and rig are inline in the initial application module, so there is no separate sprite/image request or texture pop-in. Geometry is measured in a layout effect before revealing the stage.
- Inactive panels are inert and excluded from layout and the accessibility tree. Navigation buttons expose `aria-current="step"`. Every active chapter has a visible H1.
- Shell header is a fixed sibling on this route, reserving space inside the stage; it is not a scrolling ancestor. Mobile scene clipping uses `overflow:clip`, not a scroll container.
- Debug view: `/?debug=1#story` (progress, chapter, SVG path point).

## Verification checklist

- [x] Window is the only scrolling container; no nested Story scrollers or double scrollbars at tested dimensions.
- [x] Fast forward/reverse scrolling and arbitrary jumps reproduce the same rat transform at the same progress.
- [x] Idle observation leaves the scene unchanged; no running Story CSS animations.
- [x] Native wheel and emulated native touch drag update the same progress.
- [x] Initial `/#story`, `/#story/organs`, legacy `/#story-dose`, chapter buttons, browser history and palette jumps match text and rat.
- [x] Resize and orientation event tests recalculate geometry and progress.
- [x] 100dvh stage, reserved SVG geometry, static loading skeleton.
- [x] Responsive checks at 375×667, 768×1024, 1440×900 and 844×390, including all six chapters.
- [x] Reduced motion: stationary chapter poses, full PK curve, no gait or pulsing.
- [x] Dose keyboard input, profile changes, organ selection, HED validation and workbench CTA.
- [x] No console errors or warnings in the six-station viewport tests.
- [x] Six chapters pass axe checks in light/dark; full-page accessibility checks also cover the shared chrome.
- [x] Debug overlay available only with `?debug=1`.
- [ ] Firefox and Safari verified: **blocked**. Firefox and WebKit browser downloads returned HTTP 403 “Domain forbidden”. No Safari installation is available on this Linux host. Chromium touch emulation is not a real iOS Safari test.
- [x] Production mobile Lighthouse: **97 Performance / 100 Accessibility**, LCP 1.6s, TBT 170ms, CLS 0.000159 (approximately zero).
- [x] Typecheck, ESLint, 318 unit tests (215 core + 103 web), production build and all original bundle budgets pass.

## Test results and limits

52 distinct Chromium browser cases passed across the targeted runs: 11 full-page accessibility cases; 30 Lab, shell, Story and toxicity cases; 3 Learn cases; 1 presenter case; 1 production-build smoke case; and 6 reviewed Story screenshot baselines. The final Story suite separately passed all 10 cases after the mobile navigation spacing correction. The production smoke test opened every Lab section and found no failed requests or runtime errors.

Lighthouse used the production Vite preview, default simulated mobile throttling and system Chromium, with other browser tests stopped. An earlier concurrent run scored 78 with 890ms TBT while other browser tests were using the CPU; it is not used as the isolated benchmark. These are local lab results, not a guarantee of field performance or a measurement of Vercel network latency.

The Linux Story screenshot baselines are in `apps/web/e2e/visual.spec.ts-snapshots/`. The earlier Windows baselines for the replaced Story remain historical; regenerate those on Windows before using that platform's visual gate. The unrelated Lab visual baselines were not regenerated.

The default scene is an illustrated SVG rig, not a photorealistic 3D model. This is deliberate: every pose and path point can be reproduced directly from scroll without a WebGL clock or asynchronous model loading. The existing 3D Lab model remains available in the workbench.

## Reproduce

```sh
npm run typecheck
npm run lint
npm test
npm run bundle
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test e2e/story.spec.ts e2e/presenter.spec.ts
# From apps/web, when the other engines are available:
CROSS_BROWSER=1 npx playwright test e2e/story.spec.ts
```

The browser checks above use Chromium. The cross-browser configuration adds Firefox and WebKit; a WebKit result must not be described as testing the actual Safari application. Real device checks for dynamic browser chrome remain a release QA item.

The generator in `npm run ci` also rewrites prewarmed simulation data with platform-dependent last-bit floating-point differences (20,450 values in this environment). That unrelated generated file was restored; no simulation parameters or equations were changed by this Story work.

