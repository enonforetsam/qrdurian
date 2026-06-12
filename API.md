# qrdurian API

qrdurian designs are **URLs**. There is no server-side API to call and nothing to authenticate —
you construct a link, and opening it loads the full design in the editor at
[qrdurian.com](https://qrdurian.com), ready to tweak, download (PNG/SVG), or share.

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
| `corner` | `rounded` `circle` `square` | finder-eye style |
| `dot` | `rounded` `dots` `square` | module (data dot) shape |
| `font` | `urbanist` `playfair display` `caveat` `bebas neue` `space mono` | caption typeface (lazy-loaded) |
| `scenebg` | `gradient` `solid` | background fill style |
| `margin` | 0–10 | quiet-zone size |
| `format` | `square` `wallpaper` `poster` `story` | export canvas (2048², 1290×2796, A4@300DPI, 1080×1920) |

**Examples**

```
https://qrdurian.com/?data=https://example.com&look=matcha
https://qrdurian.com/?data=wa.me/60123456789&look=kopitiam&caption=ORDER%20HERE
https://qrdurian.com/?data=WIFI:T:WPA;S:MyCafe;P:kopi123;;&look=wifi
https://qrdurian.com/?data=https://example.com&ink=stamp&bg=163300&fg=9FE870&base=ffffff
```

## Hash format (compact, used by Share → Link)

`https://qrdurian.com/#d=<base64url(JSON)>` where the JSON uses short keys:

| Key | Field | | Key | Field |
|---|---|---|---|---|
| `u` | data | | `o` | outline color |
| `n` | caption | | `t` | caption color |
| `f` | fg (ink) | | `w` | outline width 0–10 |
| `b` | base | | `m` | margin 0–10 |
| `g` | background | | `c` | corner type |
| `s` | sceneBg | | `z` | format |
| `x` | texture | | `i` | ink mood |
| `y` | dot (module) shape | | `q` | caption font |
| `v` | free text items (array of `{t,x,y,s,f,c}`: text, relative x/y, size, font, color) | | `e` | extra QR contents (array of ≤2 strings — multi-code artboard) |

Encoding: `JSON.stringify` → UTF-8 → base64 with `+/` → `-_` and padding stripped.
All fields are optional and validated on load; invalid values fall back to defaults.
Uploaded/emoji center logos are **not** carried in URLs (image data is too large).

## MCP server (for AI assistants)

A remote [MCP](https://modelcontextprotocol.io) server lives in [`mcp/`](mcp/) — one tool,
`design_qr`, that takes friendly parameters and returns a qrdurian link. Connect with:

```
claude mcp add --transport http qrdurian https://<your-worker>.workers.dev/mcp
```

See [`mcp/README.md`](mcp/README.md) for deploy + connect instructions.

## Notes

- Everything renders client-side in the visitor's browser; constructing links costs nothing.
- The schemas above are stable; new params may be added but existing ones won't change meaning.
