# 🍈 qrdurian

**Design beautiful, custom QR codes in seconds. Free, no signup, open source.**
Live at **[qrdurian.com](https://qrdurian.com)** · MIT licensed ([LICENSE](LICENSE)) · contributions welcome

qrdurian is a single-file, mobile-first QR code designer. You land on a bright durian-yellow
page with a live QR floating in the middle, walk through four steps — Content → Style →
Artboard → Export — and leave with a print-ready PNG or vector SVG. Everything runs in the
browser; nothing is uploaded anywhere. No account, no paywall — every feature is free.

---

## Product tour

| Step | Card | What you control |
|---|---|---|
| 1 | **Content** | The link/text the code opens. "Generate QR" melts the code into ink and reforms it. |
| 2 | **Style** | Corner style, the color trio (Ink / Base / Background), QR Outline color + thickness. |
| 3 | **Artboard** | Background fill (gradient/solid), texture, quiet margin, caption text + color, center logo. |
| 4 | **Export** | Size (Square / Phone wallpaper / Poster A4 / Story), file type (PNG/SVG), Download, Share. |

Signature touches:

- **Ink engine** — QR modules are rendered as realistic ink: fiber-wicking jitter, ragged
  "goo" edges, coffee-ring rim pooling, paper grain. Every Generate press produces a subtly
  unique impression. (SVG export stays clean vector by design.)
- **Looks gallery** — the strip under the artboard holds 20 complete named designs
  (12 palette looks + 8 "dressed" looks like Kopitiam ☕ MENU, Wi-Fi, Pay Here, Wedding 💍)
  with labeled, style-true thumbnails. Tap to wear the whole look: palette, texture, ink,
  corners, module shape — and caption + center logo, *unless* the user has set their own
  (smart takeover: one custom caption/logo edit and looks become visuals-only).
  On desktop (≥900×700) the strip opens into a wrapped two-row gallery, all looks visible.
- **Shuffle** (top-right ↻) — rolls one of the 20 looks at random; every roll scannable.
- **Textures** — 10 repeating patterns (durians, topography, dots, grid, stripes, waves,
  crosses, spikes, leaves, hexagons). Waves is the landing default.
- **Logos** — uploaded center logos are auto-rounded (18% radius) to match the design
  language; error correction bumps to H automatically.
- **The page is the canvas** — the design's background *is* the page background; the chrome
  flips light/dark from its luminance. The exported file reproduces it 1:1.
- **Studio layout** (≥1100px) — full Canva anatomy: a vertical icon rail (Content / Looks /
  Style / Artboard / Export) plus a full-height design panel fill the left side; the whole
  right side is the editor — a horizontal bar (caption text, font, color, artboard size
  chips) over the live canvas. The canvas reshapes to the chosen format; non-square gets a
  dashed file-bounds frame. The looks gallery lives in the panel's Looks tab (one DOM node,
  reparented across the 1100px breakpoint).
- **Caption fonts** — five curated faces (Urbanist, Playfair Display, Caveat, Bebas Neue,
  Space Mono), lazy-loaded from Google Fonts on first use; dressed looks pick their own
  (Wedding→Playfair, Receipt→Space Mono, Neon→Bebas, Makan→Caveat). `font=` query param,
  hash key `q`.
- **Free text items + canvas selection** — "+ Text" in the editor bar drops a text item on
  the artboard (up to 8, hash key `v`). Click any text (or the caption) on the canvas to
  select it: dashed box + ✕ handle, drag to move, Delete key works, and the editor bar
  becomes selection-aware (edits the picked item's text/font/color). Exports render items
  via the same `drawScene` — the overlay never ships. Caption removal marks it
  user-customized so looks don't re-add it.
- **Multi-code artboards** — "Add another QR" (Content card) puts up to 3 codes on one
  design, sharing the style; `sceneLayout` rows them on wide artboards, stacks on tall
  (hash key `e`). Click a card to point the Content field at that code, ✕/Delete removes
  it (the last code stays).
- **Studio panel density** — Content / QR style / Artboard stack in the full-height panel
  with section titles; rail icons smooth-scroll to their section. Looks swaps the whole
  panel view (`body.looks-tab`).

## Design system

- **Palette**: durian yellow `#FFE14D` (default bg) · leaf green `#2E7D32` (accents) ·
  forest `#163300` / bright `#9FE870` (brand mark, dark-mode accents) · black `#101113`
  reserved exclusively for download actions.
- **Type**: Urbanist (display: brand, labels, buttons) + Open Sans (body) — Google Fonts.
- **Icons**: [Lucide](https://lucide.dev), pinned at `0.452.0` via unpkg.
- **Surfaces**: borderless white cards on color, floating white pill nav with circular
  buttons (Wise-inspired), no drop shadows — flat with one intentional outline: the QR's own.
- **Motion**: Web Animations API spring bounces for the cards (scale-from-center, no
  vertical travel), QR shake + ink melt on Generate, `prefers-reduced-motion` respected.

## Architecture

The app lives in **`index.html`** (CSS + vanilla JS, no build step). Marketing/SEO pages
(`about.html`, `looks.html`, `404.html`) share `design-system.css` + `design-system.js`
(tokens + a Müller-Brockmann editorial grid). Only two runtime dependencies, both CDN:
`qr-code-styling` (QR rendering) and `lucide` (icons).

Key invariants — **do not break these**:

1. **One layout function.** `sceneLayout(W,H)` is the single source of truth for where the
   QR card, caption, and outline sit. Preview, crop math, and exports all call it; preview
   and file can never disagree.
2. **CSS/JS height pairing.** The cards' CSS `max-height` (`min(46vh, 420px)`, and the
   `max-height: 500px` landscape override) must match `sheetH` in `fitPreview()` — that's
   what guarantees an open card never covers the QR or its caption.
3. **The QR never moves while editing.** Mobile/tablet: it centers on the page when no card
   is open, docks to a fixed upper position when one opens, and ignores export-size changes
   (format applies to the file only). Studio (≥1100px, Canva-style): the design card docks
   as a left panel, the canvas centers in the remaining zone regardless of panel state, and
   the canvas DOES reshape to the chosen format (aspect chips above it; non-square formats
   get a dashed file-bounds frame since the page bg bleeds past the artboard edge).
   `isStudio()` in JS must match the studio CSS media query (`min-width: 1100px`).
4. **Textures are defined twice on purpose.** `textureSVG()` (CSS tiles for the page) and
   `TEX_TILES` (canvas-native `Path2D` for exports) mirror each other — SVG images taint the
   canvas on iOS Safari and break `toBlob`. New textures must be added to both.
5. **Floating dropdowns live on `<body>`.** The cards carry transforms (pop animations),
   which hijack `position: fixed` descendants — `#fmtList`/`#texList` are reparented at boot.

Render pipeline (PNG): `qr-code-styling` renders modules on transparency → `inkify()`
(jitter → blur+contrast threshold → pixel pass for rim pooling/grain, hard 45% alpha cutoff)
→ `drawScene()` composes background, texture pattern, white card, outline, ink QR, caption
→ `toBlob` download. Share uses the same pipeline via the Web Share API.

## Zero backend

There is no server. A design is **entirely described by its URL**, so the whole app is static
files on a CDN — nothing to run, nothing to maintain, no database, no accounts, no tracking.
Sharing works by encoding the design into the URL (`/#d=…`); opening that link rebuilds it in
the editor. (Earlier versions had an optional tracking/shortener worker — removed 2026-06-16 to
keep the project fully static and maintenance-free.)

## API & AI access

A qrdurian design is fully described by its URL — which makes the URL the API:

- **Query params** (human/AI-friendly): `qrdurian.com/?data=<content>&look=kopitiam&ink=stamp&caption=SCAN%20ME` (`theme=` kept as alias)
- **Hash format** (compact, what Share → Link produces): `qrdurian.com/#d=<base64url JSON>`
- **MCP server** ([`mcp/`](mcp/)): one `design_qr` tool so Claude & friends can create designs natively
- **[`llms.txt`](llms.txt)**: teaches any AI assistant to construct design links unaided

Full reference: **[API.md](API.md)**

## Repo files

| File | Purpose |
|---|---|
| `index.html` | The editor app (CSS + vanilla JS, no build) |
| `about.html` · `looks.html` | About + FAQ · the 20-design gallery (SEO pages, on the shared grid) |
| `design-system.css` · `design-system.js` | Shared tokens + the Müller-Brockmann editorial grid for the marketing pages |
| `mcp/` · `llms.txt` · `API.md` | AI access: MCP server (stateless URL builder), AI primer, design-URL reference |
| `durian.svg` · `apple-touch-icon.png` · `icon-192.png` · `icon-512.png` | Brand mark / favicon / PWA icons |
| `manifest.json` | PWA manifest |
| `og.png` / `og.html` · `apple-icon.html` | Social preview image / generator sources |
| `404.html` · `robots.txt` · `sitemap.xml` | Hosting hygiene |
| `LICENSE` | MIT |

## Deploy

- **Site:** push to `main` → GitHub → Cloudflare Pages serves **qrdurian.com**. No build, no CI, no server.
  A `staging` branch auto-builds a preview at `staging.qrdurian.pages.dev` — work there, then merge to `main`.
- **Local dev:** `python3 -m http.server 8400` in the repo root, open `localhost:8400`.

## Contributing

Issues and PRs welcome. There's no build step — open `index.html` (or run a static server) and
edit. Please keep the [architecture invariants](#architecture) intact (one layout function,
CSS/JS height pairing, textures defined twice, etc.) and keep the app dependency-light and
no-signup. By contributing you agree your work is licensed under the project's MIT license.

## License

[MIT](LICENSE) © 2026 Danial Alias and qrdurian contributors. Free to use, modify, and
self-host.

---

Made in KL 🇲🇾 · spiky on the outside, scannable on the inside.
