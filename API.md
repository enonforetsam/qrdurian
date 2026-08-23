# qrdurian API

qrdurian designs are **URLs**. There is no server-side API to call and nothing to authenticate —
you construct a link, and opening it loads the full design in the editor at
[qrdurian.com](https://qrdurian.com), ready to tweak, download (PNG/JPG/SVG), or share.

This makes qrdurian instantly usable by scripts, AI assistants, and humans alike.

## Query-param API (human-readable)

```
https://qrdurian.com/?data=<content>&look=<name>&ink=<mood>&texture=<name>&caption=<text>
```

| Param | Values | Notes |
|---|---|---|
| `data` (or `url`) | any text ≤ 2000 chars | what the QR opens — URL, text, `WIFI:T:WPA;S:ssid;P:pass;;`, `mailto:`, `wa.me/<phone>` … |
| `look` (or `theme`) | palette looks: `durian` `matcha` `midnight` `ocean` `berry` `tangerine` `mono` `lavender` `sky` `sunset` `mint` `paper` · dressed looks: `kopitiam` `makan` `pay` `wifi` `wedding` `music` `receipt` `neon` | a complete design — palette, texture, ink, corners, module shape; dressed looks also bring a caption + center logo. Individual params below override it |
| `ink` | `press` `stamp` `brush` | ink rendering mood |
| `texture` | `none` `durians` `topo` `dots` `grid` `stripes` `waves` `crosses` `spikes` `leaves` `hex` | background pattern |
| `caption` | text ≤ 80 chars | shown under the code (empty hides it) |
| `fg` | 6-digit hex, `#` optional | ink color of the modules |
| `base` | hex | the rounded card behind the code |
| `bg` | hex | page / scene background (also drives light/dark chrome) |
| `outline` | hex | QR outline ring color |
| `outlinew` | 0–10 | outline thickness (0 = none, default 7) |
| `capcolor` | hex | caption color |
| `corner` | `rounded` `circle` `square` | finder-eye style (`extra-rounded` and `dot` accepted as aliases) |
| `dot` | `rounded` `dots` `square` | module (data dot) shape |
| `font` | `urbanist` `playfair display` `caveat` `bebas neue` `space mono` | caption typeface (lazy-loaded) |
| `scenebg` | `gradient` `solid` | background fill style |
| `margin` | 0–10 | quiet-zone size |
| `format` | `square` `wallpaper` `poster` `story` `sheet` `tent` `counter` | export canvas: 2048², 1290×2796, A4@300DPI, 1080×1920 ~ plus print sheets: `sheet` A4 sticker sheet (design tiled 3×4, cut guides), `tent` A4 fold-in-half table tent, `counter` A5 counter card with crop marks. Print sheets export PNG/JPG only |
| `embed` | `1` | chrome-less render for iframes: just the artboard + a quiet "Designed on qrdurian" badge. Combine with any params above |

**Examples**

```
https://qrdurian.com/?data=https://example.com&look=matcha
https://qrdurian.com/?data=wa.me/60123456789&look=kopitiam&caption=ORDER%20HERE
https://qrdurian.com/?data=WIFI:T:WPA;S:MyCafe;P:kopi123;;&look=wifi
https://qrdurian.com/?data=https://example.com&ink=stamp&bg=163300&fg=9FE870&base=ffffff
https://qrdurian.com/?data=https://example.com&look=pay&format=tent
<iframe src="https://qrdurian.com/?data=https://example.com&look=neon&embed=1"></iframe>
```

## Hash format (compact, used by Copy design link)

`https://qrdurian.com/#d=<base64url(JSON)>` where the JSON uses short keys:

| Key | Field | Valid values |
|---|---|---|
| `u` | data | string ≤ 2000 chars |
| `n` | caption | string ≤ 80 chars |
| `f` | fg (ink) | `#rrggbb` |
| `b` | base (card) | `#rrggbb` |
| `g` | background | `#rrggbb` |
| `o` | outline color | `#rrggbb` |
| `t` | caption color | `#rrggbb` |
| `w` | outline width | number 0–10 |
| `m` | margin | number 0–10 |
| `c` | corner type | `extra-rounded` `dot` `square` (internal names ~ the query param's `rounded`/`circle` map to `extra-rounded`/`dot`) |
| `y` | dot (module) shape | `rounded` `dots` `square` |
| `q` | caption font | exact family: `Urbanist` `Playfair Display` `Caveat` `Bebas Neue` `Space Mono` |
| `a` | QR size on the artboard | number 0.35–0.8 (default 0.58) |
| `s` | sceneBg | `gradient` `solid` |
| `z` | format | `square` `wallpaper` `poster` `story` `sheet` `tent` `counter` |
| `x` | texture | `none` `durians` `topo` `dots` `grid` `stripes` `waves` `crosses` `spikes` `leaves` `hex` |
| `i` | ink mood | `press` `stamp` `brush` |
| `e` | extra QR contents | array of ≤ 2 strings ≤ 2000 chars ~ multi-code artboard (up to 3 codes total) |
| `p` | manual QR positions | array of ≤ 3 entries, each `null` (auto layout) or `{x, y}` with 0–1 relative center ~ set by dragging a code on the canvas |
| `v` | free text items | array of ≤ 8 `{t, x, y, s, f, c}`: text ≤ 80 chars, relative x/y 0–1, size 0.02–0.2, font family (see `q`), hex color |
| `j` | stickers | array of ≤ 10 `{t, k, x, y, s, c}`: `t` = `"icon"` or `"emoji"`, `k` = a Lucide icon name or an emoji ≤ 8 chars, relative x/y 0–1, size 0.04–0.5, hex tint ~ sprites rebuild client-side, pixels never serialize |
| `l` | center logo | `data:image/…` URI ≤ 8192 chars ~ only tiny logos travel (emoji logos are webp-compressed under the cap); big uploads stay on-device and are never serialized |
| `_c` | takeover flags | `{n, q, l}` booleans ~ marks the caption / caption font / logo as user-customized, so applying a dressed look won't overwrite them |

Encoding: `JSON.stringify` → UTF-8 → base64 with `+/` → `-_` and padding stripped.
All fields are optional and validated on load; invalid values fall back to defaults.
Opening a `#d=` link marks the caption as intentional (a shared design's caption is
never stomped by a look change).

## MCP server (for AI assistants)

A remote [MCP](https://modelcontextprotocol.io) server lives in [`mcp/`](mcp/) and runs at:

```
https://mcp.qrdurian.com/mcp
```

Two tools ~ `design_qr` takes friendly parameters and returns a qrdurian link;
`list_looks` lists every curated look with a one-line description. Connect with:

```
claude mcp add --transport http qrdurian https://mcp.qrdurian.com/mcp
```

See [`mcp/README.md`](mcp/README.md) for deploy + connect instructions (claude.ai custom
connector, Claude Code, Claude Desktop).

## Notes

- Everything renders client-side in the visitor's browser; constructing links costs nothing.
- The schemas above are stable; new params may be added but existing ones won't change meaning.
