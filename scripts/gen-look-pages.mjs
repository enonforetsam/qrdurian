#!/usr/bin/env node
// gen-look-pages.mjs — static SEO page generator for qrdurian.
// Zero deps. Reads the LOOKS array out of looks.html (the clean, display-ready
// source: it carries label + cap + palette per look; index.html's copy is
// editor-state shaped and lacks labels for the first twelve), then emits:
//   looks/<id>.html            one page per look
//   wifi-qr-code.html          \
//   whatsapp-qr-code.html       | four use-case landers at the top level
//   pay-here-qr-code.html       |
//   wedding-qr-code.html       /
//   sitemap.xml                the 3 existing URLs + every generated page
// Run:  node scripts/gen-look-pages.mjs
// House copy rule: "~" never an em dash.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://qrdurian.com";

// ---- extract LOOKS from looks.html ----------------------------------------
const looksSrc = readFileSync(join(ROOT, "looks.html"), "utf8");
const m = looksSrc.match(/const LOOKS = (\[[\s\S]*?\]);/);
if (!m) throw new Error("LOOKS array not found in looks.html");
const LOOKS = new Function("return " + m[1])();
if (LOOKS.length !== 20) console.warn(`warn: expected 20 looks, got ${LOOKS.length}`);

// ---- deterministic faux-QR glyph (ported verbatim from looks.html) --------
// Pre-rendered at build time into inline SVG so the pages need zero JS.
function qrGlyph(fg, base, seed) {
  const N = 11, cell = 100 / N;
  let rects = "";
  const finder = (cx, cy) => {
    rects += `<rect x="${cx * cell}" y="${cy * cell}" width="${cell * 3}" height="${cell * 3}" rx="${cell * 0.6}" fill="${fg}"/>`;
    rects += `<rect x="${(cx + 0.85) * cell}" y="${(cy + 0.85) * cell}" width="${cell * 1.3}" height="${cell * 1.3}" rx="${cell * 0.35}" fill="${base}"/>`;
  };
  finder(0, 0); finder(N - 3, 0); finder(0, N - 3);
  let s = seed * 2654435761 >>> 0;
  const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  const inFinder = (x, y) =>
    (x < 3 && y < 3) || (x >= N - 3 && y < 3) || (x < 3 && y >= N - 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (inFinder(x, y)) continue;
    if (rnd() > 0.52)
      rects += `<rect x="${x * cell + cell * 0.12}" y="${y * cell + cell * 0.12}" width="${cell * 0.76}" height="${cell * 0.76}" rx="${cell * 0.28}" fill="${fg}"/>`;
  }
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="decorative QR code preview">${rects}</svg>`;
}

// ---- per-look copy (2-3 sentences each, genuinely useful) -----------------
const COPY = {
  durian: "Crisp black modules on a warm off-white card ~ the most scannable pairing there is, dressed up just enough to not look like clip art. It suits anywhere reliability beats decoration: shop counters, invoices, flyers, name cards. If a scanner is old, cheap, or in bad light, this is the look that still reads first time.",
  matcha: "Deep leaf-green modules on a soft matcha card over a bright green ground. It reads as fresh and organic, which makes it a natural fit for cafes, juice bars, plant shops and anything eco-labelled. The contrast between ink and card stays high, so it scans as well as it looks.",
  midnight: "Bright green modules glowing out of a near-black ground ~ the light-on-dark inversion that phone cameras still read cleanly because the code itself sits on a light card. Made for bars, night markets, gig posters and tech meetups. On a dark wall or a dim room it disappears into the decor until someone points a camera at it.",
  ocean: "Deep navy ink on white, floating on a sea-glass blue. Calm and trustworthy ~ good for travel operators, dive shops, pool decks and hotel welcome cards. The navy-on-white core keeps contrast maximal even when the print fades in the sun.",
  berry: "Dark plum modules on a blush card over hot pink. It is loud in the way a dessert cabinet is loud ~ bakeries, bubble tea, boutiques and anything aimed at a sweet tooth. The dark ink keeps it scannable despite all that colour.",
  tangerine: "Burnt-brown ink on a cream card over full tangerine orange. Orange is the colour of appetite and urgency, so this one earns its keep on food-stall signage, promo posters and limited-time offers. High contrast where it counts, heat everywhere else.",
  mono: "Near-black stamp-ink modules on plain white and warm grey ~ no colour at all, which is exactly the point. It suits galleries, minimal brands, packaging and print where the QR should whisper, not shout. Maximum contrast also means maximum scan range.",
  lavender: "Deep violet modules on a pale lilac card over soft purple. Gentle without being washed out ~ a fit for salons, spas, stationery shops and wedding-adjacent stuff that wants colour but not noise. The dark violet ink keeps every scanner happy.",
  sky: "Sea-deep blue ink on white over a powder-blue ground. Clean, calm and a little clinical in the best way ~ clinics, kids' events, laundromats, anywhere that wants to feel light and tidy. White card plus dark ink is the same contrast recipe as a boarding pass.",
  sunset: "Deep purple modules brushed onto a warm cream card over sunset peach. The brush ink gives it a hand-made edge, so it works for festivals, evening events and anything with a golden-hour mood. The purple-on-cream core keeps it readable even with the loose ink style.",
  mint: "Deep pine ink on a mint-white card over fresh green. It reads as clean and healthy ~ pharmacies, wellness studios, salad bars, fresh produce. A quiet look that still pops against most shelves and counters.",
  paper: "Soft black stamp ink on white over a warm paper tone, like something pulled off a letterpress. Bookshops, craft markets, zines and packaging inserts all wear it well. The stamp texture adds character without eating into scannability.",
  kopitiam: "Coffee-brown modules on a cream card over kopitiam amber, capped MENU with a coffee cup. Built for exactly what it says: table-top menu codes at kopitiams, coffee shops and mamaks. Print it small on a table tent ~ the warm palette hides coffee-ring stains better than white ever will.",
  makan: "Chilli-red ground, cream card, deep maroon ink and a MAKAN caption in a handwritten face. This is the hawker-stall special ~ stick it on a stall front, a food-truck flank or a delivery flyer and it says \"food here\" before anyone reads a word. The dark ink on cream keeps it scanning through laminate glare.",
  pay: "Hot pink ground, blush card, square modules and a PAY caption with a card emoji. Made for the payment moment: paste in your Touch 'n Go, DuitNow transfer or checkout link and stand it at the counter. Square modules give it a sturdy, official feel that suits money.",
  wifi: "Sky-blue ground, pale blue card, rounded dot modules and a WI-FI caption with signal bars. The classic \"scan to join\" table card for cafes, guesthouses and waiting rooms ~ encode your network with the WIFI: format and phones join on scan. Rounded dots keep it friendly; the dark blue ink keeps it readable.",
  wedding: "Warm blush and cream with soft dot modules and a SAVE THE DATE caption in a serif face. Made for invites, RSVP links and shared photo albums ~ it sits quietly on card stock next to calligraphy instead of fighting it. The muted palette photographs well in flat-lay invitation shots.",
  music: "Indigo night ground, pale periwinkle card and a PLAY ME caption. Point it at a Spotify link, a demo, a setlist ~ gig posters, band merch and studio doors all suit it. The dark-on-light card keeps the scan solid even on a dim venue wall.",
  receipt: "Thermal-paper white and grey, square modules, THANK YOU set in a mono typeface ~ it looks like it slid out of a till printer on purpose. Perfect for order slips, packaging inserts and review-request cards in parcels. Square modules and mono type keep the receipt fiction consistent.",
  neon: "Near-black ground, pale green card, brush-ink modules and an ENTER caption with a lightning bolt. Club doors, esports lobbies, launch parties ~ anywhere the invitation should feel like a secret. The light card carries the contrast so the dark theatrics cost nothing in scans.",
};

// ---- shared page chrome ---------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// warm-white design system, trimmed to what these static pages use
// (token values mirror design-system.css :root ~ the canonical light set)
const CSS = `
:root{--bg:#f4f4f5;--panel:#ffffff;--panel-2:#fafafa;--text:#18181b;--muted:#71717a;
--border:#e4e4e7;--accent:#2E7D32;--accent-ink:#ffffff;--char:#2b2d31;--char-hover:#3a3d44;
--r-md:12px;--r-lg:18px;--r-xl:24px;
--font-display:"Urbanist",system-ui,sans-serif;--font-body:"Open Sans",-apple-system,system-ui,sans-serif;
--font-mono:"Space Mono",ui-monospace,monospace;
--shadow:0 1px 2px rgba(0,0,0,.04),0 12px 40px rgba(0,0,0,.08)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:880px;margin:0 auto;padding:32px 20px 64px}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:36px}
.brand{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:800;font-size:18px;letter-spacing:-.02em;text-decoration:none}
.brand img{width:32px;height:32px;display:block}
.brand span{color:var(--accent)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:var(--r-md);padding:12px 18px;font-family:var(--font-display);font-size:14px;font-weight:700;letter-spacing:-.01em;cursor:pointer;text-decoration:none;transition:transform .15s ease,background .15s ease}
.btn:hover{transform:translateY(-1px)}
.btn.accent{background:var(--accent);color:var(--accent-ink);border-color:transparent}
.btn.big{font-size:16px;padding:15px 26px;border-radius:var(--r-lg)}
.crumbs{font-family:var(--font-mono);font-size:12px;color:var(--muted);letter-spacing:.04em;margin:0 0 14px}
.crumbs a{color:var(--text);text-decoration:none}
.crumbs a:hover{color:var(--accent)}
h1{font-family:var(--font-display);font-weight:800;font-size:clamp(28px,5vw,44px);line-height:1.08;letter-spacing:-.03em;margin:0 0 12px}
h1 em{color:var(--accent);font-style:normal}
h2{font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:-.02em;margin:40px 0 12px}
.lede{font-size:18px;color:var(--muted);margin:0 0 28px;max-width:60ch}
.hero{display:grid;grid-template-columns:minmax(240px,340px) 1fr;gap:28px;align-items:start;margin:28px 0}
@media(max-width:640px){.hero{grid-template-columns:1fr}}
.poster{border-radius:var(--r-xl);display:flex;align-items:center;justify-content:center;padding:32px;box-shadow:var(--shadow);border:1px solid var(--border)}
.tile{width:100%;max-width:200px;aspect-ratio:1/1;border-radius:var(--r-md);padding:16px 16px 12px;display:flex;flex-direction:column;align-items:center;gap:9px;box-shadow:0 6px 20px rgba(0,0,0,.18)}
.tile svg{width:100%;flex:1;min-height:0}
.cap{font-family:var(--font-display);font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;line-height:1;white-space:nowrap}
.copy p{margin:0 0 14px;max-width:62ch}
.palette{display:flex;gap:10px;margin:18px 0 22px;flex-wrap:wrap}
.swatch{display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:6px 14px 6px 6px;font-family:var(--font-mono);font-size:12px;color:var(--muted)}
.swatch i{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);display:block}
.cta-block{text-align:center;padding:36px 20px;margin-top:44px;background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-xl)}
.cta-block p{color:var(--muted);margin:0 0 18px}
.steps{list-style:none;counter-reset:s;padding:0;margin:0 0 8px;display:grid;gap:12px}
.steps li{counter-increment:s;background:var(--panel);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px 18px 16px 56px;position:relative}
.steps li::before{content:counter(s);position:absolute;left:16px;top:14px;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-family:var(--font-display);font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center}
.faq details{background:var(--panel);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 18px;margin:0 0 10px}
.faq summary{font-family:var(--font-display);font-weight:700;cursor:pointer}
.faq p{color:var(--muted);margin:10px 0 2px;max-width:62ch}
.related{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.related a{text-decoration:none;background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:8px 16px;font-family:var(--font-display);font-weight:700;font-size:13px}
.related a:hover{border-color:var(--accent);color:var(--accent)}
.foot{text-align:center;margin-top:56px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:14px}
.foot a{color:var(--muted);text-decoration:none}
.foot a:hover{color:var(--accent)}
`.trim();

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@700;800&family=Open+Sans:wght@400;600&family=Space+Mono:wght@400&display=swap" rel="stylesheet">`;

function shell({ title, desc, canonical, jsonld, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${SITE}/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${SITE}/og.png" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" type="image/svg+xml" href="/durian.svg" />
<meta name="theme-color" content="#9FE870" />
${FONTS}
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 1)}
</script>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <a class="brand" href="/"><img src="/durian.svg" alt="qrdurian" /> QR <span>Durian</span></a>
    <a class="btn accent" href="/">Try it free</a>
  </div>
${body}
  <footer class="foot">
    <a href="/">QR Durian</a> · <a href="/looks">All designs</a> · <a href="/about">About</a> · Free QR code designer · No signup required
  </footer>
</div>
</body>
</html>
`;
}

const previewBlock = (t, i) => `
    <div class="poster" style="background:${t.bg}">
      <div class="tile" style="background:${t.base}">
        ${qrGlyph(t.fg, t.base, i + 1)}
        <div class="cap" style="color:${t.capc || t.fg}">${t.cap}</div>
      </div>
    </div>`;

const paletteBlock = (t) => `
      <div class="palette" aria-label="colour palette">
        <span class="swatch"><i style="background:${t.bg}"></i>${t.bg} ground</span>
        <span class="swatch"><i style="background:${t.base}"></i>${t.base} card</span>
        <span class="swatch"><i style="background:${t.fg}"></i>${t.fg} ink</span>
      </div>`;

// ---- looks/<id>.html ------------------------------------------------------
mkdirSync(join(ROOT, "looks"), { recursive: true });
const urls = [];

LOOKS.forEach((t, i) => {
  const copy = COPY[t.name];
  if (!copy) throw new Error(`no copy for look "${t.name}"`);
  const title = `${t.label} QR code style ~ free QR designer`;
  const canonical = `${SITE}/looks/${t.name}`;
  const firstSentence = copy.split("~")[0].trim().replace(/\.$/, "") + ".";
  const desc = `${t.label} QR code design: ${firstSentence} Open it in the free QR Durian editor ~ no signup, no watermark.`;
  const related = LOOKS.filter((x) => x.name !== t.name)
    .slice()
    .filter((_, j) => [(i + 3) % 19, (i + 7) % 19, (i + 11) % 19, (i + 14) % 19].includes(j))
    .slice(0, 4);
  const body = `
  <nav class="crumbs"><a href="/">Home</a> · <a href="/looks">Designs</a> · ${esc(t.label)}</nav>
  <h1>The <em>${esc(t.label)}</em> QR code style</h1>
  <p class="lede">A ready-made look for QR Durian, the free in-browser QR designer. Open it, swap in your link, tweak anything, export ~ no signup, no watermark.</p>
  <div class="hero">
${previewBlock(t, i)}
    <div class="copy">
${paletteBlock(t)}
      ${copy.split(/(?<=\.) (?=[A-Z])/).map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
      <p style="margin-top:18px"><a class="btn accent big" href="/?look=${t.name}">Use the ${esc(t.label)} style ~ free →</a></p>
    </div>
  </div>
  <div class="cta-block">
    <p>Everything is editable once it's open ~ colours, caption, texture, ink style, even extra text and stickers.</p>
    <a class="btn accent" href="/?look=${t.name}">Open ${esc(t.label)} in the editor</a>
  </div>
  <h2>More styles</h2>
  <div class="related">
    ${related.map((x) => `<a href="/looks/${x.name}">${esc(x.label)}</a>`).join("\n    ")}
    <a href="/looks">All 20 designs →</a>
  </div>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: canonical,
    description: desc,
    isPartOf: { "@type": "WebApplication", name: "QR Durian", url: SITE + "/" },
  };
  writeFileSync(join(ROOT, "looks", `${t.name}.html`), shell({ title, desc, canonical, jsonld, body }));
  urls.push(canonical);
  console.log(`looks/${t.name}.html`);
});

// ---- use-case landers -----------------------------------------------------
const lookByName = Object.fromEntries(LOOKS.map((t, i) => [t.name, { ...t, i }]));

const LANDERS = [
  {
    file: "wifi-qr-code.html",
    look: "wifi",
    title: "Free Wi-Fi QR code maker ~ scan to join, no signup",
    h1: `Make a <em>Wi-Fi</em> QR code guests can scan to join`,
    desc: "Turn your Wi-Fi network name and password into a styled QR code guests scan to connect ~ free, in the browser, nothing uploaded, no watermark.",
    lede: "Type your network name and password once, print the code, and guests join by pointing their camera at it ~ no more spelling out passwords across the counter.",
    cta: `/?data=${encodeURIComponent("WIFI:T:WPA;S:My Cafe WiFi;P:changeme123;;")}&look=wifi`,
    ctaLabel: "Make my Wi-Fi QR code ~ free →",
    steps: [
      "Open the editor with the Wi-Fi style ~ it arrives pre-filled with the WIFI: format.",
      "Replace the network name and password with your own (the bit after S: and P:).",
      "Style it if you like, then export a PNG and print it for the table or wall.",
    ],
    faq: [
      ["What format does a Wi-Fi QR code use?",
       "It encodes a plain-text string like WIFI:T:WPA;S:NetworkName;P:password;; ~ a standard both iPhone and Android cameras understand. Scanning it prompts the phone to join that network directly, no typing."],
      ["Is my Wi-Fi password uploaded anywhere?",
       "No. QR Durian runs entirely in your browser ~ the code is generated on your device and the page is static. Your network name and password never leave your machine."],
      ["What happens if I change my Wi-Fi password?",
       "The QR code is static ~ it encodes the exact password you typed, so a changed password means the old code stops working. Just come back, make a new one and reprint. It's free every time."],
    ],
  },
  {
    file: "whatsapp-qr-code.html",
    look: "matcha",
    title: "WhatsApp QR code maker ~ scan to chat, free",
    h1: `Make a <em>WhatsApp</em> QR code that opens a chat with you`,
    desc: "Turn your WhatsApp number into a styled QR code ~ customers scan it and land straight in a chat with you. Free, in the browser, no signup.",
    lede: "A wa.me link inside a QR code drops the scanner straight into a WhatsApp chat with your number ~ perfect for order-taking, enquiries and \"WhatsApp us\" signage.",
    cta: `/?data=${encodeURIComponent("https://wa.me/60123456789")}&look=matcha&caption=${encodeURIComponent("WHATSAPP US")}`,
    ctaLabel: "Make my WhatsApp QR code ~ free →",
    steps: [
      "Open the editor ~ it arrives pre-filled with a wa.me link and a WHATSAPP US caption.",
      "Replace the number with yours in international format, e.g. wa.me/60123456789 for a Malaysian number.",
      "Restyle it to match your brand, export, and stick it where customers wait.",
    ],
    faq: [
      ["How does a WhatsApp QR code work?",
       "It encodes the link https://wa.me/<your number>. When someone scans it, their phone opens WhatsApp with a chat to that number already started ~ they just type and send."],
      ["Can it pre-fill a message?",
       "Yes ~ add ?text= to the link, like https://wa.me/60123456789?text=Hi!%20I%27d%20like%20to%20order. The scanner sees the message drafted and only has to press send."],
      ["Does the code expire or cost anything?",
       "No. The QR is a static image encoding a plain link ~ it works for as long as your WhatsApp number does, and QR Durian is free with no signup and no watermark."],
    ],
  },
  {
    file: "pay-here-qr-code.html",
    look: "pay",
    title: "Pay Here QR code maker ~ style your payment link, free",
    h1: `Make a <em>Pay Here</em> QR code for your counter`,
    desc: "Dress your payment link ~ Touch 'n Go, DuitNow transfer link, checkout page ~ as a styled Pay Here QR code for the counter. Free, no signup, no watermark.",
    lede: "Paste the payment link you already use ~ a Touch 'n Go profile, a DuitNow transfer link, a checkout page ~ and turn it into a counter-ready PAY HERE code that matches your stall.",
    cta: `/?look=pay&data=${encodeURIComponent("https://example.com/your-payment-link")}`,
    ctaLabel: "Make my Pay Here QR code ~ free →",
    steps: [
      "Open the editor with the Pay Here style ~ caption and card emoji included.",
      "Paste your real payment link over the placeholder ~ whatever page you'd normally send customers to.",
      "Export a PNG, print it, and stand it next to the till.",
    ],
    faq: [
      ["Can this replace my bank's DuitNow QR?",
       "No ~ an official DuitNow QR is issued by your bank or e-wallet and encodes a special payment payload only they can generate. QR Durian styles a link: it's for payment pages, transfer links and e-wallet profiles you'd otherwise send by chat. Keep the bank's QR for direct DuitNow scans."],
      ["Is it safe to put a payment link in a QR code?",
       "The code encodes exactly the link you paste and nothing else ~ nothing is added, shortened or redirected. Scan your own print with your phone before putting it out, so you've verified it lands where you expect."],
      ["Is there any fee or watermark?",
       "No ~ QR Durian is free and runs in your browser. No signup, no watermark, no cut of anything. It's a static page that draws an image; your money flows through whatever link you encoded, same as before."],
    ],
  },
  {
    file: "wedding-qr-code.html",
    look: "wedding",
    title: "Wedding QR code maker ~ RSVP & photo album codes, free",
    h1: `Make a <em>wedding</em> QR code worth printing on the invite`,
    desc: "A soft blush Save-the-Date QR code for RSVP forms, wedding sites and shared photo albums ~ styled to sit next to calligraphy. Free, no signup, no watermark.",
    lede: "Link your RSVP form, wedding site or shared photo album, and get a code in blush and cream that belongs on card stock ~ not a barcode slapped on an invitation.",
    cta: `/?look=wedding&data=${encodeURIComponent("https://example.com/our-wedding")}`,
    ctaLabel: "Make my wedding QR code ~ free →",
    steps: [
      "Open the editor with the Wedding style ~ SAVE THE DATE caption, serif face and ring included.",
      "Paste your RSVP form, wedding site or album link over the placeholder.",
      "Tweak the colours to match your palette, export, and hand it to your printer.",
    ],
    faq: [
      ["What should a wedding QR code link to?",
       "The three that earn their place: an RSVP form so replies collect themselves, your wedding site for directions and schedule, or a shared photo album where guests upload their shots during the reception. One code per job scans best."],
      ["Will the code still work after the wedding?",
       "Yes ~ the QR is static and never expires. It works for as long as the link behind it works, so an album code on a thank-you card keeps collecting photos for months."],
      ["Can I match it to our wedding colours?",
       "Fully ~ the Wedding style is a starting point. Every colour, the caption, the font and the texture are editable in the free editor, so it can match your stationery exactly. Keep the ink much darker than the card and it will scan fine."],
    ],
  },
];

for (const L of LANDERS) {
  const t = lookByName[L.look];
  const canonical = `${SITE}/${L.file.replace(/\.html$/, "")}`;
  const body = `
  <nav class="crumbs"><a href="/">Home</a> · ${esc(L.title.split("~")[0].trim())}</nav>
  <h1>${L.h1}</h1>
  <p class="lede">${esc(L.lede)}</p>
  <div class="hero">
${previewBlock(t, t.i)}
    <div class="copy">
      <h2 style="margin-top:0">Three steps, no account</h2>
      <ol class="steps">
        ${L.steps.map((s) => `<li>${esc(s)}</li>`).join("\n        ")}
      </ol>
      <p style="margin-top:18px"><a class="btn accent big" href="${L.cta}">${esc(L.ctaLabel)}</a></p>
    </div>
  </div>
  <h2>Questions, answered honestly</h2>
  <div class="faq">
    ${L.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n    ")}
  </div>
  <div class="cta-block">
    <p>Prefer a different style? There are 20 ready-made looks, all editable.</p>
    <a class="btn accent" href="/looks">Browse all designs</a>
  </div>`;
  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: L.title,
      url: canonical,
      description: L.desc,
      isPartOf: { "@type": "WebApplication", name: "QR Durian", url: SITE + "/" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: L.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
  writeFileSync(join(ROOT, L.file), shell({ title: L.title, desc: L.desc, canonical, jsonld, body }));
  urls.push(canonical);
  console.log(L.file);
}

// ---- sitemap.xml ----------------------------------------------------------
// The 3 original URLs are pinned; any OTHER entry already in the sitemap that
// this generator doesn't own (e.g. pages added by another workstream) is
// preserved verbatim on re-runs.
const fixed = [
  [`${SITE}/`, "weekly", "1.0"],
  [`${SITE}/looks`, "monthly", "0.9"],
  [`${SITE}/about`, "monthly", "0.8"],
];
const owned = new Set([...fixed.map(([l]) => l), ...urls]);
let foreign = [];
try {
  const prev = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  foreign = [...prev.matchAll(/<url>[\s\S]*?<\/url>/g)]
    .map((b) => b[0])
    .filter((b) => {
      const loc = (b.match(/<loc>(.*?)<\/loc>/) || [])[1];
      return loc && !owned.has(loc);
    })
    .map((b) => "  " + b.replace(/\n\s*/g, "\n    ").replace(/\n\s*<\/url>$/, "\n  </url>"));
} catch { /* no existing sitemap */ }
const entry = ([loc, cf, pr]) => `  <url>
    <loc>${loc}</loc>
    <changefreq>${cf}</changefreq>
    <priority>${pr}</priority>
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fixed.map(entry).join("\n")}
${foreign.length ? foreign.join("\n") + "\n" : ""}${urls.map((u) => entry([u, "monthly", u.includes("/looks/") ? "0.6" : "0.7"])).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);
console.log(`sitemap.xml (${fixed.length + foreign.length + urls.length} urls; ${foreign.length} preserved)`);
