# yem-hjk6th-personal-web

Personal website of Ye Ma, built with Astro and published with GitHub Pages at
<https://yem.sh>.

| Path | What it is |
| --- | --- |
| `/` | Homepage: name, the two audience headlines, a three.js hero (a Hilbert-curve toolpath printed bead by bead), projects filterable by audience, about, publications, contact |
| `/projects/<slug>/` | One page per entry in `content/projects.yaml` |

The homepage was chosen from three drafts (see [`docs/design-notes.md`](docs/design-notes.md)).

## Content

All text comes from `content/*.yaml` (`profile`, `projects`, `publications`,
`experience`). The pages add no facts of their own. Where a page needs text the
YAML does not have (for example a project `result: null`), it shows a visible
TODO label instead.

The hero scene is procedural three.js code (`src/scenes/`). No stock images or
third-party models are used.

## Project media

Each project's `media` in `content/projects.yaml` holds one `thumbnail`, a list
of large `images` and an optional `video`. Leave it as `media: []` (or leave a
field out) until files exist; the page then shows the generated drawing for
that project (`src/lib/glyph.ts`).

Files live in **`public/media/<slug>/`** and are served unchanged at
`/media/<slug>/<file>`. In the YAML, `src` is the path relative to
`public/media/`.

```yaml
media:
  thumbnail:
    src: living-column/photo.jpg
    alt: "What the photo shows"          # required
    zoom: 1.6                            # optional, display-only zoom (1 to 4)
    focus: "52% 72%"                     # optional, point to zoom on (x% y%)
    credit: "Photo: CT .lab, University of Virginia, 2025"   # optional
  images:                                # large images on the project page
    - src: living-column/photo.jpg
      alt: "What the photo shows"
      zoom: 1.6
      focus: "52% 72%"
      caption: "Optional caption."
      credit: "Photo: ..."
  video:                                 # optional
    src: living-column/clip.mp4
    poster: living-column/clip-poster.jpg
    caption: "Optional caption."
```

`zoom` and `focus` crop by display only (CSS `object-fit: cover`,
`object-position` and `scale`); the file is never edited. The thumbnail frame is
4:3 and the large frame 3:2, so any photo works, and `focus` picks what stays
in view.

Expected sizes:

| Field | Size | Format | File size |
| --- | --- | --- | --- |
| `thumbnail` | at least 600 x 450 px | JPEG or WebP | under 300 KB |
| `images` | 1600 to 2400 px on the long edge | JPEG or WebP | under 600 KB each |
| `video` | up to 1920 x 1080, a few seconds to a minute | MP4 (H.264), no audio needed | under 5 MB (repository limit) |
| `poster` | same as the video frame | JPEG | under 300 KB |

If a listed file is missing, the build still succeeds: the page shows the
drawing plus a TODO naming the missing path.

## Theme

Dark only. All colours are tokens at the top of `src/styles/theme.css`. The page
background is the single token `--bg`; the candidates are `#000000` (current)
and `#4D4D4D`. Text and accent colours pass WCAG AA on both:

| Token | Hex | On #000000 | On #4D4D4D | Use |
| --- | --- | --- | --- | --- |
| `--ink` | `#F2F2F2` | 18.76:1 | 7.55:1 | body text |
| `--muted` | `#C8C8C8` | 12.55:1 | 5.05:1 | secondary text |
| `--blue` | `#A3C8FF` | 12.26:1 | 4.94:1 | links and controls at rest |
| `--gold` | `#F2C14E` | 12.51:1 | 5.04:1 | hover, focus, pressed |

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
- The hero scene loads after the page has painted, pauses when off-screen, and
  after its short intro only redraws when scrolling changes it. Without WebGL a
  CSS placeholder stays in place.
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
| React, React DOM | MIT | Used only for the React Bits islands |
| js-yaml | MIT | Build time only |
| [GSAP](https://gsap.com) + ScrollTrigger | GSAP Standard "No Charge" License (not MIT, not open source) | See below |
| [React Bits](https://github.com/DavidHDev/react-bits) components | MIT + Commons Clause | See below |
| Archivo | SIL Open Font License 1.1 | © 2020 The Archivo Project Authors, via `@fontsource-variable/archivo` |
| Living Column photo (`public/media/living-column/`) | Not an open licence; used on this site with Ye's approval | Credited on the page as "Photo: CT .lab, University of Virginia, 2025". Do not reuse it elsewhere without asking the lab |

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
`frontend-design` skill (Apache 2.0) and the `ui-ux-pro-max` skill (MIT).
