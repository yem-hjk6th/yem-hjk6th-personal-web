# Design notes

Working notes for the three homepage drafts. Kept so the next design pass
knows what was tried and why.

## Variant 1: "Print bed" (frontend-design skill)

**Subject.** A PhD candidate who instruments robotic 3D printers with cameras
and telemetry, with an architecture background. The readers are recruiters
skimming for fit. The page's job: show in five seconds that this person works
where robots, vision and building materials meet, then let each reader filter
to their half.

**Plan, first pass**

- Color: concrete `#E7E8E3` (page), graphite `#1B2024` (text), slate
  `#4F575E` (secondary text), ultramarine `#2B3FC4` (links, toolpath accent),
  bead white `#F6F6F3` (raised surfaces), swell amber `#C98A1B` (only inside
  the 3D bead, where it marks corners).
- Type: one family, Archivo (variable width axis). The name is set very wide
  and heavy; body at normal width; metadata condensed instead of monospace.
- Layout: left-aligned. Full-bleed canvas behind the hero, name at bottom-left,
  two audience blocks below it, then a project list, publications, contact.

```
+------------------------------------------------+
| Ye Ma          Work  Publications  Contact     |
|                         [ printing column ]    |
| YE MA (very wide)       [   3D canvas     ]    |
| PhD candidate, UVA                              |
|------------------------+-----------------------|
| Robotics & CV          | AEC & fabrication     |
| headline               | headline              |
| Show these projects    | Show these projects   |
+------------------------------------------------+
| Work  [All] [Robotics & CV] [AEC & fab]        |
| ==== layer ======================================|
| glyph | title, one-line problem   | years tags  |
| ==== layer ======================================|
```

**Review against the brief.** A pale grey page with a blue accent is close to
what any engineering portfolio would get. What is specific here is the
printing itself, so:

- Changed the section dividers from hairlines to rounded "bead" rules (two
  stacked 3px lines), so the project list reads as printed layers.
- Changed the audience entries from two equal cards to two typographic blocks
  whose buttons share the filter's pressed state, so the entry and the filter
  are visibly the same control.
- Kept all-caps labels, mono labels, numbered markers and arrow suffixes out.
  Years are the only numbering, because they are a real sequence.
- Motion: one orchestrated moment only, the column printing on load and
  continuing as you scroll. No section fade-ins.

## Variant 2: Swiss grid (ui-ux-pro-max skill)

Generated with `search.py "robotics research portfolio engineering"
--design-system`. Output used as given:

- Pattern: Portfolio Grid (hero name/role, filterable project grid,
  about, contact).
- Style: Swiss Modernism 2.0, 12-column grid, mathematical spacing.
- Colors: primary `#1E3A5F`, secondary `#2563EB`, accent `#A16207`,
  background `#F8FAFC`, foreground `#0F172A`, muted foreground `#475569`,
  border `#CBD5E1`.
- Type: EB Garamond (headings) / Crimson Text (body).
- Checklist: no emoji icons, visible focus, 4.5:1 text contrast,
  reduced motion, responsive at 375/768/1024/1440.
- GSAP preset taken from `--domain gsap`: scroll-scrubbed build-up instead of
  per-element reveals.

Hero: a braced strut lattice that builds from the base as the page scrolls.

## Variant 3: Variant 1 + React Bits

Starts from variant 1 (judged stronger: its type and the printing scene are
specific to Ye's work, while variant 2's academic serif register could belong
to any researcher). Adds four React Bits components, each tied to an action
or a reading moment:

- VariableProximity on the name: Archivo's width and weight axes respond to
  the pointer.
- ScrollReveal on the bio: words fill in as you scroll through it.
- SpotlightCard on the project entries: a soft light follows the pointer or
  keyboard focus.
- Magnet on the contact links.

Hero: the same bead sweep, but the toolpath is a Hilbert curve (one of the
three toolpath strategies in the ACADIA 2025 mycelium-mineral paper), printed
as a shallow panel.

## Round 2: chosen direction

Ye chose variant 3. It is now the homepage at `/`; variants 1 and 2 and the
chooser were removed (their code is in the git history of PR #1).

Dark theme only, with a blue + gold accent pair:

- One background token, `--bg`, with two candidates (`#000000` and `#4D4D4D`).
  Every text colour was chosen to pass WCAG AA on both, so either can be kept
  without re-checking contrast. Rules and raised surfaces are mixed from `--bg`
  (`color-mix`), so they follow it.
- Blue `#A3C8FF` for links and controls at rest; gold `#F2C14E` for hover,
  focus and pressed states. The two have almost the same lightness, so each
  state also changes form (thicker underline, outline, filled button), never
  colour alone.
- Hilbert hero: light grey bead, gold where the bead swells at corners, blue
  nozzle. SpotlightCard uses its dark palette with a blue light; its surface is
  transparent so rows sit on either background.
