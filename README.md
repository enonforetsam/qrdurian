# 🍈 qrdurian

**Design beautiful, custom QR codes in seconds. Free, no signup.**
Live at **[qrdurian.com](https://qrdurian.com)**

qrdurian is a single-file, mobile-first QR code designer. You land on a bright durian-yellow
page with a live QR floating in the middle, walk through four steps — Content → Style →
Artboard → Export — and leave with a print-ready PNG or vector SVG. Everything runs in the
browser; nothing is uploaded anywhere.

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
- **Studio layout** (≥1100px) — Canva-style: design card docked left, canvas on the right
  with aspect-ratio chips (Square / Phone / A4 / Story) above it; the canvas reshapes live
  to the chosen format and the looks gallery stays browsable while editing.

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

Everything lives in **`index.html`** (~1,500 lines: CSS + vanilla JS, no build step).
Only two runtime dependencies, both CDN: `qr-code-styling` (QR rendering) and `lucide` (icons).

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
| `index.html` | The entire app |
| `durian.svg` | Brand mark (rounded-spike durian with QR-face) — also the favicon |
| `apple-touch-icon.png` | iOS home-screen icon |
| `manifest.json` | PWA manifest |
| `og.png` / `og.html` | Social preview image / its generator source |
| `apple-icon.html` | Touch-icon generator source |
| `about.html` | About page (currently a shell — needs content) |
| `404.html`, `robots.txt`, `sitemap.xml` | Hosting hygiene |

## Deploy

Push to `main` → GitHub → Cloudflare serves **qrdurian.com**. No build, no CI.
Local dev: `python3 -m http.server 8400` in the repo root, open `localhost:8400`.

## Known deferred items

- `about.html` is empty but listed in `sitemap.xml` — fill or unlist before SEO indexing.
- PWA manifest declares a single SVG icon; a 512px PNG would improve install behavior.
- Generator sources (`og.html`, `apple-icon.html`) are deployed publicly — harmless, untidy.
- Assorted dead CSS from removed controls (audited, catalogued, cosmetic only).

---

Made in KL 🇲🇾 · spiky on the outside, scannable on the inside.
