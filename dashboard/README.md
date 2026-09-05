# PS-005 — front-end design reference

A working, static prototype of a marketing/landing page for **PS-005**, a
vector storage engine. This is meant as a **visual and structural reference**
for another build tool (e.g. Antigravity) to implement the real site against
— it is not a production app (no bundler, no framework build step).

Open `index.html` directly in a browser, or serve the folder statically.

---

## Design concept

The subject is a storage engine, not a consumer product — so the page is
built like an **engineering drawing sheet**, not a SaaS marketing template:

- Every major section carries a **title block** (`.titleblock`) borrowed
  from blueprint sheets: a sheet number, a name, and metadata — the same way
  a mechanical drawing identifies itself in the corner of the page.
- The hero carries a **corner stamp** (`.stamp`) — the one place the design
  spends its visual "boldness."
- Diagrams are the primary content, not decoration: an animated canvas
  pipeline diagram in the hero, a rotating three.js proximity graph in the
  read-path section, and a plain benchmark bar chart — each mounted in a
  `.plate` frame, like a figure plate in a spec sheet.
- Numbered sequences (`.stage-list` / `.callout-grid`) are used only where
  content is a genuine sequence (the write path, the read path stages) —
  not as generic decoration.
- Flat panels, hairline borders, near-zero border radius, no drop shadows —
  consistent with technical drafting, not soft SaaS UI chrome.

Explicitly avoided: neon accents, the cream+terracotta AI-default palette,
near-black+acid-green palette, rounded SaaS cards with soft shadows,
ALL-CAPS eyebrow labels, and "→" arrows on buttons.

## Design tokens (`styles/_tokens.scss`)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#12151c` | page background (graphite-navy, not near-black) |
| `--panel` | `#181c25` | section/card surfaces |
| `--paper` | `#e9e5d8` | primary text (warm bone, not stark white) |
| `--brass` | `#c08a4e` | primary accent — write path, primary actions |
| `--slate` | `#6a8caa` | secondary accent — query/read path |
| `--rust` | `#ad4d34` | tertiary — compaction/deletion/outliers |

Typography: **IBM Plex Serif** (display/headlines), **IBM Plex Sans**
(body), **IBM Plex Mono** (data labels, stamps, diagram annotations —
functionally justified here since the product is data/latency-numbers
heavy, not used as decoration).

All tokens are CSS custom properties on `:root`, so they can be reused
directly regardless of what framework Antigravity builds the real site in.

## File structure

```
index.html                 single-page markup, semantic sections
styles/
  _tokens.scss              color / type / spacing / motion tokens
  _base.scss                 resets, base typography, grid background
  _titleblock.scss           the title-block & stamp motif
  _layout.scss                header, hero, section rhythm, footer
  _diagram.scss                plate frames, legends, callout grid
  _components.scss             buttons, stats, stage list, chart plate
  main.scss                     entry point (@use-forwards all partials)
dist/main.css                compiled CSS (regenerate with `sass styles/main.scss dist/main.css`)
js/
  pipeline-diagram.js        canvas 2D animated write/read pipeline (hero)
  hnsw-scene.js               three.js r128 proximity-graph visualization
  benchmark-chart.js           canvas 2D latency bar chart
  gsap-animations.js            load-in sequence + scroll-driven stage list
  main.js                        wires all modules to their DOM containers
```

## Rebuilding the CSS

```
npm install -g sass
sass styles/main.scss dist/main.css
```

## Motion notes for the rebuild

- Only two orchestrated motion moments exist on purpose: the hero load-in
  sequence, and the scroll-driven highlight of the write-path stage list.
  Everything else is either continuous background animation (the two
  diagrams) or a plain hover state — please don't add fade/slide-up
  entrances to every section or card when rebuilding.
- All motion respects `prefers-reduced-motion`: the canvas/three.js scenes
  freeze on a representative static frame, and GSAP sequences are skipped
  entirely.

## What to keep vs. what's placeholder

- Keep: the title-block/stamp motif, the palette, the type pairing, the
  plate-mounted diagram treatment, the sequence-only use of numbering.
  These are the load-bearing design decisions.
- Placeholder: exact benchmark numbers, exact copy in each section — swap
  in real figures/copy from the product team before shipping.
