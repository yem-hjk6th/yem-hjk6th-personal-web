# yem-hjk6th-personal-web

Personal website of Ye Ma, built with Astro and published with GitHub Pages at
<https://yem.sh>.

This is a draft with **three homepage variants** to compare before one is kept:

| Path | What it is |
| --- | --- |
| `/` | Chooser linking to the three drafts |
| `/v1/` | "Print bed": one expanded typeface, a column printed bead by bead, projects as a layered log |
| `/v2/` | Swiss grid, navy and serif type, a strut lattice that builds as you scroll, filterable card grid |
| `/v3/` | Variant 1 plus React Bits effects and a Hilbert-curve toolpath hero |
| `/projects/<slug>/` | One page per project, shared by all variants |

Design notes for each variant are in [`docs/design-notes.md`](docs/design-notes.md).

## Content

All text comes from `content/*.yaml` (`profile`, `projects`, `publications`,
`experience`). The pages add no facts of their own. Where a page needs text the
YAML does not have (for example a project `result: null`), it shows a visible
TODO label instead.

There are no photos yet. Every project shows a procedural SVG drawing seeded by
its slug (`src/lib/glyph.ts`), and the hero scenes are procedural three.js code
(`src/scenes/`). No stock images or third-party models are used.

## Develop

Requires Node 22.

```bash
npm ci
npm run dev       # http://localhost:4321
npm run check     # type check
npm run build     # static site in dist/
```

## Deploy

`.github/workflows/deploy.yml` builds on every push and pull request and
deploys `main` to GitHub Pages with `actions/upload-pages-artifact` and
`actions/deploy-pages`. One-time repository settings:

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Settings → Pages → Custom domain: **`yem.sh`** (no `CNAME` file is needed
   with an Actions deployment), then enable **Enforce HTTPS** once the
   certificate is issued.
3. At the DNS provider for `yem.sh`, point the apex domain at GitHub Pages
   (A/AAAA records as listed in GitHub's Pages documentation).

## Motion and accessibility

- `prefers-reduced-motion: reduce` turns off Lenis smooth scrolling, GSAP
  scroll effects and the React Bits animations, and the hero scenes render one
  still, finished frame.
- The hero scenes load after the page has painted, pause when off-screen, and
  after their short intro only redraw when scrolling changes them. Without
  WebGL a CSS placeholder stays in place.
- Layouts are checked from 390 px to 1440 px wide.

## Privacy

No analytics, tracking, cookies or third-party embeds. Fonts are self-hosted
from npm packages; the page makes no requests to other domains. There is no
contact form; contact is the links in `content/profile.yaml`.

## Third-party code and licences

| What | Licence | Notes |
| --- | --- | --- |
| [Astro](https://astro.build), `@astrojs/react` | MIT | |
| [three.js](https://threejs.org) | MIT | Only the library; all scene code is our own |
| [Lenis](https://github.com/darkroomengineering/lenis) | MIT | |
| React, React DOM | MIT | Used only for the `/v3/` islands |
| js-yaml | MIT | Build time only |
| [GSAP](https://gsap.com) + ScrollTrigger | GSAP Standard "No Charge" License (not MIT, not open source) | See below |
| [React Bits](https://github.com/DavidHDev/react-bits) components | MIT + Commons Clause | See below |
| Archivo | SIL Open Font License 1.1 | © 2020 The Archivo Project Authors, via `@fontsource-variable/archivo` |
| EB Garamond | SIL Open Font License 1.1 | © 2017 The EB Garamond Project Authors, via `@fontsource/eb-garamond` |
| Crimson Text | SIL Open Font License 1.1 | © 2010 The Crimson Text Project Authors, via `@fontsource/crimson-text` |

**GSAP.** GSAP 3.15 is published under GreenSock's Standard "No Charge"
License (<https://gsap.com/standard-license>; the npm package's `license`
field points there, and the package states "Copyright (c) 2008-2026,
GreenSock. All rights reserved."). Since GSAP became free in 2025 the
licence allows use in personal and commercial websites at no cost, including
the former Club plugins such as ScrollTrigger. It is not an open-source
licence: the code stays GreenSock's, and the licence excludes using GSAP in a
product that competes with Webflow's visual animation tools. A personal
website is within its terms. *The full licence text could not be read while
building this draft (gsap.com was blocked by the build environment's network
policy); the summary above should be checked against the page before
publishing.*

**React Bits.** Four components (VariableProximity, ScrollReveal,
SpotlightCard, Magnet) are copied into `src/components/reactbits/`, each with
a header naming its source, the licence and any changes. The licence is MIT
plus the Commons Clause: the components may be used as part of this website,
including commercially, but may not be sold, sublicensed or redistributed on
their own. The full text is in
[`src/components/reactbits/LICENSE-react-bits.md`](src/components/reactbits/LICENSE-react-bits.md).

**Design tooling** (used while building, not shipped): Anthropic's
`frontend-design` skill (Apache 2.0) for variant 1 and the `ui-ux-pro-max`
skill (MIT) for variant 2.
