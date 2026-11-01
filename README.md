# yem-hjk6th-personal-web

Personal website of Ye Ma, built with Astro and published with GitHub Pages at
<https://yem.sh>.

| Path | What it is |
| --- | --- |
| `/` | Homepage: name (click it to open a floating window), the two audience headlines, a pixel-art story animation, projects filterable by audience, about, publications, contact |
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
    fit: cover                           # optional, cover (crop to frame) or contain (whole image)
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

`fit` decides whether an image is cropped. By default, SVG drawings among the
large `images` use `contain`: they are shown whole, at their own aspect ratio,
so wide diagrams keep all their labels. Everything else uses `cover`, which
fills the frame. Thumbnails always keep their 4:3 frame; with `fit: contain`
they are letterboxed inside it.

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

Dark only, on pure black. All colours are tokens at the top of
`src/styles/theme.css`; the page background is the single token `--bg`
(`#000000`), so it can be changed in one place. Text and accent colours pass
WCAG AA:

| Token | Hex | On #000000 | Use |
| --- | --- | --- | --- |
| `--ink` | `#F2F2F2` | 18.76:1 | body text |
| `--muted` | `#C8C8C8` | 12.55:1 | secondary text |
| `--blue` | `#A3C8FF` | 12.26:1 | links and controls at rest |
| `--gold` | `#F2C14E` | 12.51:1 | hover, focus, pressed |

## Hero animation

`public/media/hero/rsi_pixel_story.mp4` is a 12 s silent loop of 320 x 180
pixel art rendered at 1280 x 720 (H.264, about 165 KB), made with
[animate](https://github.com/cth9191/animate) (MIT) from a storyboard. Its
source is kept outside this repo; to change a scene, re-render and replace the
file. `rsi_pixel_story_still.png` (a frame of scene 3) is the poster.
`src/scenes/pixel-story.ts` is the earlier code-drawn canvas version, kept for
reference and no longer imported.

1. Four sensors watch a print: robot telemetry, stereo camera, bead camera,
   nozzle borescope.
2. The view steps out to a lab monitor that builds a live reconstruction, with
   gold marks where the print deviates.
3. Cut to the goal: a large robot arm printing a ship hull.

It plays only while on screen.

## Floating window

Clicking the name (or Enter / Space on it) opens a small desktop-style window
(`src/scripts/floating-window.ts`). It uses a native `<dialog>`: focus moves into
it, Esc and the close button close it, focus returns to the name, and the page
does not scroll while it is open. On wide screens with a mouse it can be
dragged by its title bar; on phones it stays centred. Its content is a
placeholder loop (the earlier Hilbert-panel three.js scene, loaded only when the
window first opens) until the real content is decided.

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
  scroll effects and the React Bits animations. The hero shows one still frame
  of scene 3, and the floating window's placeholder renders one still frame.
- The hero video plays only while on screen. The floating window's three.js placeholder loads only when the
  window opens and stops when it closes.
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
| [animate](https://github.com/cth9191/animate) | MIT | Used offline to render the hero video; no code from it ships with the site |
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
