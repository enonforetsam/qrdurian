# 🍈 qrdurian

**Design beautiful, custom QR codes in seconds. Free, no signup, open source.**
Live at **[qrdurian.com](https://qrdurian.com)** · MIT licensed ([LICENSE](LICENSE)) · contributions welcome

qrdurian is a single-file, mobile-first QR code designer. You land on a clean warm-white
studio with a live QR floating in the middle, walk through four steps — Content → Style →
Artboard → Export — and leave with a print-ready PNG, JPG, or full-design vector SVG.
Everything runs in the browser; nothing is uploaded anywhere. No account, no paywall —
every feature is free.

---

## Product tour

| Step | Card | What you control |
|---|---|---|
| 1 | **Content** | Two tabs. **New link**: type chips (Link / Wi-Fi / WhatsApp / vCard / Event / Pay Here) compose the standard payload live into the content field. **Existing QR**: upload a photo or screenshot of any code ~ jsQR reads it and qrdurian restyles it. "Generate QR" melts the code into ink and reforms it. |
| 2 | **Style** | Corner style, the color trio (Ink / Base / Background), QR Outline color + thickness. |
| 3 | **Artboard** | Background fill (gradient/solid), texture, quiet margin, caption text + color, center logo, free text items + stickers (compact "+ Text" / "+ Sticker" twins on mobile). |
| 4 | **Export** | Seven sizes ~ Square / Phone wallpaper / Poster A4 / Story plus three print sheets (Sticker sheet, Table tent, Counter card). File type PNG / JPG / SVG. Download, **Copy** (PNG to clipboard), **Save to Photos** (share sheet, where supported), **Copy design link**. |

Signature touches:

- **Ink engine** — QR modules are rendered as realistic ink: fiber-wicking jitter, ragged
  "goo" edges, coffee-ring rim pooling, paper grain. Every Generate press produces a subtly
  unique impression. (SVG export stays clean vector by design.)
- **Scan check** ~ the actual rendered artwork (real format, texture, ink) is decoded
  offscreen with jsQR after every edit; a badge on the artboard reads "✓ Scans"
  ("✓ Code 1 scans" on multi-code boards) or warns "⚠ May not scan ~ raise contrast".
  The decoder loads lazily ~ nobody pays for it on landing.
- **Undo / redo** ~ 50-step history of the whole design. Cmd/Ctrl+Z back,
  Shift+Cmd/Ctrl+Z (or Ctrl+Y) forward; buttons live in the mobile header, the studio
  sidebar, and the studio editor bar.
- **Theme slider** — a compact horizontal picker holds 20 complete named designs
  (12 palette looks + 8 "dressed" looks like Kopitiam ☕ MENU, Wi-Fi, Pay Here, Wedding 💍)
  with labeled, style-true thumbnails. Tap to wear the whole look: palette, texture, ink,
  corners, module shape — and caption + center logo, *unless* the user has set their own
  (smart takeover: one custom caption/logo edit and looks become visuals-only).
  The picker stays out of the artboard so the canvas remains the editing surface.
- **Shuffle** (top-right ↻) — rolls one of the 20 looks at random; every roll scannable.
- **Pay Here (DuitNow) flow** ~ the Pay Here chip explains the trick: your bank app
  already exports your DuitNow QR ~ save it, upload it under Existing QR, and qrdurian
  restyles it (the `pay` look is applied for you).
- **Textures** — 10 repeating patterns (durians, topography, dots, grid, stripes, waves,
  crosses, spikes, leaves, hexagons). Waves is the landing default.
- **Logos** — uploaded center logos are auto-rounded (18% radius) to match the design
  language; error correction bumps to H automatically. Emoji logos are squeezed into a
  tiny webp so they survive refresh *and* share links; big uploads stay on-device
  (session-only, never serialized into a URL).
- **Stickers** ~ 28 Lucide icons + 12 emojis, dropped on the artboard, tinted, dragged,
  and resized via a corner grip; they serialize by name (hash key `j`), never as pixels.
- **Soft neumorphic studio** — the editor chrome sits on a fixed warm-white surface, with
  raised and pressed controls. A dedicated editor section frames the artboard; the design
  background lives inside the artboard preview, so the exported file
  reproduces the artboard 1:1 without recoloring the UI around it.
- **Studio layout** (≥1100px) — full Canva anatomy: Content / Style / Artboard / Export
  controls fill the left side; the whole
  right side is the editor — a horizontal bar (caption text, font, color, artboard size
  chips) over the live canvas. The canvas reshapes to the chosen format; non-square gets a
  dashed file-bounds frame. Themes live in the Style section as a horizontal slider on
  mobile/tablet and in studio.
- **Caption fonts** — five curated faces (Urbanist, Playfair Display, Caveat, Bebas Neue,
  Space Mono), lazy-loaded from Google Fonts on first use; dressed looks pick their own
  (Wedding→Playfair, Receipt→Space Mono, Neon→Bebas, Makan→Caveat). `font=` query param,
  hash key `q`.
- **Free text items + canvas selection** — "+ Text" in the editor bar drops a text item on
  the artboard (up to 8, hash key `v`). Click any text (or the caption) on the canvas to
  select it: dashed box + ✕ handle, drag to move, Delete key works, and the editor bar
  becomes selection-aware (edits the picked item's text/font/color). Double-click any words
  on the canvas to edit them in place. Exports render items via the same `drawScene` — the
  overlay never ships. Caption removal marks it user-customized so looks don't re-add it.
- **Multi-code artboards** — "Add another QR" (Content card) puts up to 3 codes on one
  design, sharing the style; `sceneLayout` rows them on wide artboards, stacks on tall
  (hash key `e`). Click a card to point the Content field at that code, ✕/Delete removes
  it (the last code stays), and drag selected QR cards directly on the canvas to place them
  (manual positions travel as hash key `p`).
- **Print sheets** ~ three formats are page compositions, built at export by
  `sheetLayout()`: Sticker sheet (A4, the design tiled 3×4 with dashed cut guides),
  Table tent (A4 landscape, mirrored pair with a fold line), Counter card (A5 with crop
  marks). The artboard previews the single design cell; sheets export PNG/JPG only.
- **Embed mode** ~ `?embed=1` strips every scrap of chrome and renders just the artboard
  (a quiet "Designed on qrdurian" badge sits in the corner) ~ made for iframes.
- **Studio panel density** — Content / QR style / Artboard stack in the full-height panel
  with section titles. Theme thumbnails stay inside QR style as a horizontal slider.

## Design system

- **Palette**: warm white `#F4F4EF` (chrome surface and default artboard) · graphite
  `#3A3D40` (accents) · near-black `#1C1D20`
  reserved for generate/download actions.
- **Type**: Urbanist (display: brand, labels, buttons) + Open Sans (body) — Google Fonts.
- **Icons**: [Lucide](https://lucide.dev), pinned at `0.452.0` via unpkg.
- **Surfaces**: clean borderless neumorphic cards, raised circular icon controls, and subtle
  inset active states tuned from one shared chrome material.
- **Motion**: Web Animations API spring bounces for the cards (scale-from-center, no
  vertical travel), QR shake + ink melt on Generate, `prefers-reduced-motion` respected.

## Architecture

The app lives in **`index.html`** (CSS + vanilla JS, no build step). Marketing/SEO pages
(`about.html`, `looks.html`, `templates.html`, `404.html`) share `design-system.css` +
`design-system.js` (tokens + a Müller-Brockmann editorial grid); the per-look pages and
use-case landers are generated, self-contained HTML (see below). Three runtime
dependencies, all CDN: `qr-code-styling` (QR rendering), `lucide` (icons), and `jsqr`
(decoder ~ lazy-loaded only when the Existing-QR tab or the scan check first needs it).

Key invariants — **do not break these**:

1. **One layout function.** `sceneLayout(W,H)` is the single source of truth for where the
   QR card, caption, and outline sit. Preview, crop math, and exports all call it; preview
   and file can never disagree.
2. **CSS/JS height pairing.** The cards' CSS `max-height` (`min(46vh, 420px)`, and the
   `max-height: 500px` landscape override) must match `sheetH` in `fitPreview()` — that's
   what guarantees an open card never covers the QR or its caption.
3. **The QR never moves while editing.** Mobile/tablet: it centers in the artboard zone when no card
   is open, docks to a fixed upper position when one opens, and ignores export-size changes
   (format applies to the file only). Studio (≥1100px, Canva-style): the design card docks
   as a left panel, the canvas centers in the remaining zone regardless of panel state, and
   the canvas DOES reshape to the chosen format (the sidebar's Size picker drives it;
   non-square formats get a dashed file-bounds frame).
   `isStudio()` in JS must match the studio CSS media query (`min-width: 1100px`).
4. **Textures are defined twice on purpose.** `textureSVG()` (CSS tiles for the page) and
   `TEX_TILES` (canvas-native `Path2D` for exports) mirror each other — SVG images taint the
   canvas on iOS Safari and break `toBlob`. New textures must be added to both.
5. **Floating dropdowns live on `<body>`.** The cards carry transforms (pop animations),
   which hijack `position: fixed` descendants — `#fmtList`/`#texList` are reparented at boot.

Render pipeline (PNG/JPG): `qr-code-styling` renders modules on transparency → `inkify()`
(jitter → blur+contrast threshold → pixel pass for rim pooling/grain, hard 45% alpha cutoff)
→ `drawScene()` composes background, texture pattern, white card, outline, ink QR, caption,
free texts, and stickers → `toBlob` download (print-sheet formats pass through
`sheetLayout()` first to tile the page). **SVG export mirrors the whole scene as clean
vector** ~ gradient/solid background, the texture as an SVG `<pattern>`, cards, outline,
caption, texts, and stickers; the ink aesthetic intentionally becomes crisp modules.
Copy and Save-to-Photos reuse the same canvas pipeline via the clipboard + Web Share APIs.

## Zero backend

There is no server. A design is **entirely described by its URL**, so the whole app is static
files on a CDN — nothing to run, nothing to maintain, no database, no accounts, no tracking.
Sharing works by encoding the design into the URL (`/#d=…`); opening that link rebuilds it in
the editor. While editing, the design autosaves to `localStorage` instead of the address bar,
so the URL stays clean and a refresh restores your work. (Earlier versions had an optional
tracking/shortener worker — removed 2026-06-16 to keep the project fully static and
maintenance-free.)

## API & AI access

A qrdurian design is fully described by its URL — which makes the URL the API:

- **Query params** (human/AI-friendly): `qrdurian.com/?data=<content>&look=kopitiam&ink=stamp&caption=SCAN%20ME` (`theme=` kept as alias)
- **Hash format** (compact, what Copy design link produces): `qrdurian.com/#d=<base64url JSON>`
- **Embed**: append `?embed=1` for a chrome-less artboard made for iframes
- **MCP server** ([`mcp/`](mcp/)): live at `https://mcp.qrdurian.com/mcp` ~ two tools,
  `design_qr` + `list_looks`, so Claude & friends can create designs natively
- **[`llms.txt`](llms.txt)**: teaches any AI assistant to construct design links unaided

Full reference: **[API.md](API.md)**

## Repo files

| File | Purpose |
|---|---|
| `index.html` | The editor app (CSS + vanilla JS, no build) |
| `about.html` · `looks.html` · `templates.html` | About + FAQ · the 20-design gallery · 10 print-ready template deep links (SEO pages, on the shared grid) |
| `looks/*.html` (20) · `wifi-qr-code.html` `whatsapp-qr-code.html` `pay-here-qr-code.html` `wedding-qr-code.html` | Generated SEO pages: one per look + four use-case landers, each deep-linking the editor prefilled |
| `scripts/gen-look-pages.mjs` | Zero-dep generator: reads `LOOKS` out of `looks.html`, emits the look pages, landers, and `sitemap.xml` |
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
- **SEO pages:** after editing `LOOKS` in `looks.html`, run `node scripts/gen-look-pages.mjs`
  to regenerate `looks/`, the landers, and `sitemap.xml`.

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
