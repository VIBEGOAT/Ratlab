# Three-minute demo script

For the built-in 3-minute track (press **P**, or Ctrl/Cmd+K and choose "Present: 3-minute demo"). The track moves on by itself when you press **A**; otherwise the right arrow or a clicker's Page Down moves one slide. The same words, with more room, are in the speaker notes window (press **N**), which also shows the next slide and a clock.

The timings add up to 3:00. If you are running late, skip the "twin" slide (the right arrow moves past it).

## Before you go on

1. Open the site once on the machine you will present from, so the default study is cached. It also ships pre-baked, so a first visit is fast too.
2. Plug in the projector, then press **P**. Full screen is requested by the browser; allow it if asked.
3. Sound is off by default. Turn it on only if the room is quiet and the speakers are good. It stays silent for the humane-endpoint slide either way.
4. Put the notes window on your own screen: press **N** and drag it there.
5. If the projector machine has no graphics card, the page shows a still picture of the rat and a "Turn on 3D" button instead of a slow scene. Press the button if the machine copes; otherwise the story still works.

## The script

| Time | Slide | On screen | Say |
|---|---|---|---|
| 0:00 | Every animal we spare | Title, the animals-spared figure | "This is a virtual laboratory rat. It shows what a compound would do before any animal is dosed. It is a prototype. It does not replace animal studies; it aims to help reduce and refine them." |
| 0:12 | Meet the rat | The X-ray sweep runs head to tail | "One body: the drug moves through 17 compartments and six organs are watched for injury. Everything you see is calculated, and any run can be repeated exactly from its seed." |
| 0:24 | Choose a compound | Compound cards and the dose dial | "Five invented compounds, each harming a different organ. None is a real substance. I change the dose and the study re-runs in the background." |
| 0:36 | Dose day | Capsule, gut, liver, blood; hour counter | "Day one. The dose goes to the stomach, through the liver, into the blood. The glow is concentration from the whole-body model, scaled to each organ's own peak. This is the most mechanistic part of the model, though its inputs are still unverified." |
| 0:56 | Which organ fails first? | Five big buttons | "Before I show you: which organ shows injury first? Hands up for each, and I'll count." Tap the buttons (or press 1 to 5) as hands go up. About ten seconds. |
| 1:08 | Damage unfolds | Study-day counter, organ grades, blood tests | "Twenty-eight days, compressed. Watch the grades and the blood tests. Troponin climbs while liver and kidney markers stay normal. Signs appear as injury and the tumour grow." |
| 1:34 | The answer | Which organ, which day, share of the room | "[In the default setup:] the heart, on day twelve. [Read the percentage.] These are modelled injuries in a virtual animal. In a laboratory, a real animal would have been dosed to learn this." Keep the tone calm. |
| 1:46 | The humane endpoint | Dimmed screen, calm lines, a count | **Stop talking.** Let the room read each line. After the count appears: "That is the day a living animal would have reached its humane endpoint. Here, no one suffered." |
| 2:10 | The untreated twin | Split screen, draggable divider | "The same rat with and without treatment. A real animal can only ever be one of these." Drag the divider once. |
| 2:24 | A thousand rats | One dot per virtual rat, survival curves | "A thousand virtual rats, treated and untreated. The ranges cover chance only, not the uncertainty in the model's parameters, which are still unverified." |
| 2:38 | How far to trust it | Intended-use selector, one chip per subsystem | "Here is the honest part. Nothing has been validated against animal data, and most parameters are placeholders awaiting expert checks. For teaching, it passes. For replacing an animal study, it does not. That is why the next step is to validate one organ against real rat data." |
| 2:48 | What it could spare | The calculator with its assumptions | "The number depends entirely on assumptions, and you can edit them. If the figure changes your mind about where to start, that is the point. Questions." |

## Lines to keep, and lines never to say

Keep (they are the product's credibility): "prototype", "does not replace animal studies", "fictional compounds", "not validated", "modelled endpoint, not what the animal feels".

Never say: that it is accurate, validated, predictive of human outcomes, or a replacement for animal testing; that any dose is safe; that behaviour shows what the animal feels; or that the animals-spared number is a measurement (it is an illustration from editable assumptions).

## Likely questions

- **"Is this validated?"** No. No subsystem has been validated against real animal data. The Trust chapter and the footer say so, and the Lab's Validation view will report "no data" until real control data is loaded.
- **"Where do the numbers come from?"** From published physiology where the table could be read, otherwise placeholders marked UNVERIFIED. 117 of 125 constants are unverified today, and 8 of 32 references. Every one is listed in the Lab under Translate & Trust, Fidelity and parameters.
- **"Can it predict a real drug?"** Not yet. The compounds are invented archetypes. Real compounds would need measured ADME data and calibration.
- **"What would it take to be useful?"** Real rat control and dose-response data for one organ, a held-out comparison, and an expert review. See `docs/validation-roadmap.md` and `docs/expert-review-checklist.md`.
- **"Does it hurt animals?"** No animals are used. The humane-endpoint slide shows when a real animal would have had to be euthanised to avoid suffering.

## If something goes wrong

- The 3D scene is slow or blank: press the "Turn on 3D" button if shown, or open the page with `?3d=0` for the still-picture version. The story and numbers are identical.
- A slide is stuck: press the right arrow. Press **A** to stop auto-advance if it is moving on too fast.
- The notes window lost contact: reopen it with **N**. It reconnects by itself.
- Anything else: Escape leaves presenter mode, and Ctrl/Cmd+K jumps to any chapter.
