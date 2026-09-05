# Contributing to QRDurian

QRDurian is one HTML file. Open `index.html` (or `npm run dev` for a static server on
:8090) and you are running the current source. No build step, no framework.

```sh
npm test      # renders every look in headless Chrome and asserts it scans (~2 min)
npm run looks # regenerates the /looks/* landing pages from the LOOKS list
```

## Easiest contribution: a look

A look is one entry in the `LOOKS` array in `index.html`: colours (`fg`, `base`, `bg`,
`out`), texture, ink mood, corner and dot style, and optionally a caption, a font and
an emoji logo. Add it, run `npm test` (every look must scan), run `npm run looks`, and
open a PR with a share link.

## Rules of the file

- **It has to scan.** The scan test is the gate. If a change makes any look fail, the
  change is wrong, not the test.
- The share hash (`#d=`) is append-only; document new keys in `API.md`
  (`npm test` checks that every `hash key` in the source is documented).
- One layout function (`sceneLayout`) decides where everything sits; exports render
  through the same `drawScene` as the preview.
- Textures are defined twice on purpose (CSS tile + canvas tile). Change both.
- Keep it dependency-light and no-signup. jsQR is inlined and loads lazily.

By contributing you agree your work is released under the MIT licence.
