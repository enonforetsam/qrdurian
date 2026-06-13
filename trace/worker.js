/**
 * qrdurian trace — durian origin verification for growers.
 * Cloudflare Worker + D1 (+ optional R2 for photos). Zero dependencies.
 *
 * Flow: farmer self-registers → gets a private dashboard link (capability URL)
 * → registers harvest batches → gets a trace URL per batch → designs the
 * physical tag on qrdurian.com → consumers scan → /t/<id> verifies origin.
 * Anti-fake: tag expires 7 days after its FIRST scan.
 *
 * Bindings: DB (D1), PHOTOS (R2, optional), ADMIN_KEY (secret)
 */

import { MAP_W, MAP_H, MAP_PROJ, MAP_STATES } from "./map-data.js";

const BRAND = "qrdurian trace";
const MAIN = "https://qrdurian.com";
const EXPIRY_DAYS = 7;
const VARIETIES = ["Musang King", "Black Thorn", "D24", "Red Prawn", "IOI", "Tekka", "Kampung", "Other"];
const STATES = ["Penang", "Pahang", "Johor", "Perak", "Kedah", "Kelantan", "Negeri Sembilan", "Selangor", "Other"];

/* ---------------- helpers ---------------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function shortId(n = 8) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = crypto.getRandomValues(new Uint8Array(n));
  return [...buf].map((b) => abc[b % abc.length]).join("");
}

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Open Sans', system-ui, sans-serif; background: #FFE14D; color: #18181b; min-height: 100vh; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 28px 18px 60px; }
  h1, h2, h3, .btn, label { font-family: 'Urbanist', 'Open Sans', sans-serif; }
  h1 { font-size: 26px; margin: 18px 0 6px; } h2 { font-size: 19px; margin: 22px 0 8px; }
  .card { background: #fff; border-radius: 22px; padding: 22px; margin: 14px 0; }
  .muted { color: #71717a; font-size: 14px; }
  label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #71717a; margin: 14px 0 6px; }
  input, select, textarea { width: 100%; border: 1.5px solid #e4e4e7; border-radius: 12px; padding: 11px 13px; font-size: 15px; font-family: inherit; background: #fafafa; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #2E7D32; }
  .btn { display: inline-block; background: #2E7D32; color: #fff; border: none; border-radius: 12px; padding: 13px 22px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; margin-top: 16px; }
  .btn.black { background: #101113; }
  .btn.ghost { background: #fff; color: #2E7D32; border: 1.5px solid #2E7D32; }
  .logo { width: 46px; height: 46px; }
  .badge { display: inline-block; background: #2E7D32; color: #fff; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; }
  .badge.warn { background: #B91C1C; }
  .badge.soft { background: #E8F5D0; color: #163300; }
  .hero { text-align: center; padding: 26px 18px; border-radius: 22px; margin: 14px 0; }
  .hero.ok { background: #E8F5D0; } .hero.bad { background: #FEE2E2; }
  .hero .big { font-size: 42px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td, th { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
  .kv { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #f1f1f1; font-size: 15px; }
  .kv b { font-family: 'Urbanist', sans-serif; }
  .photo { width: 100%; border-radius: 16px; margin-top: 10px; }
  code { background: #f4f4f5; border-radius: 6px; padding: 2px 7px; font-size: 13px; word-break: break-all; }
  a { color: #2E7D32; }
`;

// hotlink the canonical logo on the main site — avoids inlining ~43KB on every trace page
const DURIAN_SVG = `<img class="logo" src="https://qrdurian.com/durian.svg" alt="qrdurian" width="46" height="46" />`;

function page(title, body, status = 200) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${BRAND}</title>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@600;700;800&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="wrap">
<div style="display:flex;align-items:center;gap:10px">${DURIAN_SVG}<b style="font-family:Urbanist;font-size:18px">${BRAND}</b></div>
${body}
<p class="muted" style="margin-top:34px">Tags by <a href="${MAIN}">qrdurian.com</a> · origin verification for Malaysian durians</p>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

/* ---------------- pages ---------------- */

function landingPage() {
  return page("Verify real durians", `
  <h1>Prove your durians are the real thing 🍈</h1>
  <p>Put a beautiful QR tag on every stem. Buyers scan it and see your orchard,
  your name, the variety and harvest date — verified. Tags expire ${EXPIRY_DAYS} days
  after first scan, so nobody can reuse them on fake fruit.</p>
  <div class="card">
    <h2>For growers</h2>
    <p class="muted">Free during the pilot. Register in 2 minutes — no app, no password.</p>
    <a class="btn" href="/register">Register my orchard</a>
  </div>
  <div class="card">
    <h2>Scanned a tag?</h2>
    <p class="muted">You'll see the orchard and harvest details instantly. A green page means
    a fresh, verified fruit. A red page means the tag is expired — be careful.</p>
  </div>
  <div class="card">
    <h2>Growers directory</h2>
    <p class="muted">Browse registered orchards across Malaysia.</p>
    <a class="btn ghost" href="/map">🗺 Durian map</a>
    <a class="btn ghost" href="/growers">Browse list</a>
  </div>`);
}

function registerPage(err = "") {
  return page("Register", `
  <h1>Register your orchard</h1>
  ${err ? `<p class="badge warn">${esc(err)}</p>` : ""}
  <form class="card" method="POST" action="/api/register">
    <label>Your name *</label><input name="name" required maxlength="80">
    <label>Phone (WhatsApp) *</label><input name="phone" required maxlength="30" placeholder="+60…">
    <label>Orchard name *</label><input name="orchard" required maxlength="100">
    <label>District</label><input name="district" maxlength="80" placeholder="e.g. Balik Pulau">
    <label>State</label><select name="state">${STATES.map((s) => `<option>${s}</option>`).join("")}</select>
    <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:14px;margin-top:16px">
      <input type="checkbox" name="directory" value="1" checked style="width:auto">
      List my orchard in the public <a href="/growers" target="_blank">growers directory</a>
    </label>
    <button class="btn" type="submit">Create my grower page</button>
    <p class="muted">You'll get a private link — bookmark it, it's your login.</p>
  </form>`);
}

function farmPage(f, batches, origin, justCreated) {
  const rows = batches.map((b) => `
    <tr><td><a href="/farm/${f.token}/batch/${b.id}">${esc(b.variety)}</a></td>
    <td>${esc(b.harvest_date)}</td><td>${b.scan_count}</td>
    <td>${b.first_scan_at ? (Date.now() - b.first_scan_at > EXPIRY_DAYS * 864e5 ? "⚠️ expired" : "✅ live") : "🕐 not scanned"}</td></tr>`).join("");
  return page("My orchard", `
  ${justCreated ? `<div class="hero ok"><div class="big">🎉</div><b>Welcome! Bookmark this page — this link is your login.</b></div>` : ""}
  <h1>${esc(f.orchard)}</h1>
  <p class="muted">${esc(f.name)} · ${esc(f.district)} ${esc(f.state)} ${f.verified ? '· <span class="badge">✓ verified grower</span>' : '· <span class="badge soft">pending verification</span>'}</p>
  <div class="card">
    <h2>New harvest batch</h2>
    <form method="POST" action="/api/batch" enctype="multipart/form-data">
      <input type="hidden" name="token" value="${f.token}">
      <label>Variety *</label><select name="variety">${VARIETIES.map((v) => `<option>${v}</option>`).join("")}</select>
      <label>Harvest date *</label><input type="date" name="harvest_date" required>
      <label>Quantity (optional)</label><input name="qty" maxlength="60" placeholder="e.g. 120 fruits">
      <label>Notes (optional)</label><textarea name="notes" maxlength="300" rows="2" placeholder="Old trees, hillside orchard…"></textarea>
      <label>Orchard / fruit photo (optional)</label><input type="file" name="photo" accept="image/*">
      <button class="btn" type="submit">Create batch & get tag</button>
    </form>
  </div>
  <div class="card"><h2>My batches</h2>
    ${batches.length ? `<table><tr><th>Variety</th><th>Harvest</th><th>Scans</th><th>Status</th></tr>${rows}</table>` : `<p class="muted">No batches yet — create your first above.</p>`}
  </div>`);
}

function batchPage(f, b, origin) {
  const traceUrl = `${origin}/t/${b.id}`;
  const designUrl = `${MAIN}/?data=${encodeURIComponent(traceUrl)}&theme=durian&ink=press&caption=${encodeURIComponent("SCAN FOR ORIGIN")}`;
  return page("Batch tag", `
  <p><a href="/farm/${f.token}">← back to my orchard</a></p>
  <h1>${esc(b.variety)} · ${esc(b.harvest_date)}</h1>
  <div class="card">
    <h2>1 · Your trace link</h2>
    <p><code>${traceUrl}</code></p>
    <p class="muted">This is what the tag's QR opens. ${b.scan_count} scan(s) so far.</p>
  </div>
  <div class="card">
    <h2>2 · Design & print your tag</h2>
    <p class="muted">Opens qrdurian with this link pre-loaded — pick a look, download the PNG, print and attach to the stem.</p>
    <a class="btn black" href="${designUrl}" target="_blank">Design my tag on qrdurian ↗</a>
  </div>
  <div class="card">
    <h2>3 · How buyers see it</h2>
    <a class="btn ghost" href="${traceUrl}" target="_blank">Preview scan page ↗</a>
    <p class="muted">Note: previewing counts as the first scan once buyers have the fruit — only preview before attaching tags, or use this test view sparingly.</p>
  </div>`);
}

function scanPage(b, origin) {
  const expired = b.first_scan_at && Date.now() - b.first_scan_at > EXPIRY_DAYS * 864e5;
  const day = b.first_scan_at ? Math.min(EXPIRY_DAYS, Math.ceil((Date.now() - b.first_scan_at) / 864e5)) : 1;
  const hero = expired
    ? `<div class="hero bad"><div class="big">⚠️</div><h1>Tag expired</h1>
       <p>This tag was first scanned more than ${EXPIRY_DAYS} days ago. The fruit it was issued
       for is no longer fresh — this tag may have been reused.</p></div>`
    : `<div class="hero ok"><div class="big">✅</div><h1>Verified origin</h1>
       <p><b>Day ${day} of ${EXPIRY_DAYS}</b> · scanned ${b.scan_count} time(s)</p></div>`;
  return page(expired ? "Tag expired" : "Verified durian", `
  ${hero}
  <div class="card">
    <div class="kv"><span>Variety</span><b>${esc(b.variety)}</b></div>
    <div class="kv"><span>Harvest date</span><b>${esc(b.harvest_date)}</b></div>
    <div class="kv"><span>Orchard</span><b>${esc(b.orchard)}</b></div>
    <div class="kv"><span>Grower</span><b>${esc(b.fname)} ${b.verified ? "✓" : ""}</b></div>
    <div class="kv"><span>Location</span><b>${esc([b.district, b.state].filter(Boolean).join(", "))}</b></div>
    ${b.qty ? `<div class="kv"><span>Batch size</span><b>${esc(b.qty)}</b></div>` : ""}
    ${b.notes ? `<p class="muted" style="margin-top:10px">"${esc(b.notes)}"</p>` : ""}
    ${b.has_photo ? `<img class="photo" src="/p/${b.id}" alt="orchard photo">` : ""}
  </div>
  ${b.verified ? `<p class="badge">✓ Verified grower — identity confirmed by qrdurian trace</p>` : ""}
  `);
}

/* counter abuse guard: 12 increments/IP/min, best-effort per isolate */
const cntBuckets = new Map();
function rateLimitedCount(ip) {
  const now = Date.now();
  const b = cntBuckets.get(ip);
  if (!b || now - b.ts > 60_000) {
    cntBuckets.set(ip, { ts: now, n: 1 });
    if (cntBuckets.size > 5000) cntBuckets.clear();
    return false;
  }
  return ++b.n > 12;
}

/* ---------------- router ---------------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const origin = url.origin;
    const DB = env.DB;

    try {
      // public counters for qrdurian.com — generates ("qrs"), downloads, shares.
      // POST /api/count?k=<key> bumps one; GET returns them all.
      const CNT_CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store" };
      const STAT_KEYS = ["qrs", "downloads", "shares"];
      if (p === "/api/count") {
        if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CNT_CORS });
        const allStats = async () => {
          const rows = (await DB.prepare("SELECT k, v FROM stats").all()).results || [];
          const out = {};
          for (const key of STAT_KEYS) out[key] = rows.find((r) => r.k === key)?.v ?? 0;
          return out;
        };
        if (req.method === "POST") {
          const k = url.searchParams.get("k");
          const key = STAT_KEYS.includes(k) ? k : "qrs"; // old clients bump qrs
          const ip = req.headers.get("cf-connecting-ip") || "?";
          if (!rateLimitedCount(ip)) {
            const row = await DB.prepare("UPDATE stats SET v=v+1 WHERE k=? RETURNING v").bind(key).first();
            if (!row) await DB.prepare("INSERT INTO stats (k, v) VALUES (?, 1)").bind(key).run();
            // coarse anonymous event row — country + device class + design context.
            // No IP, no content, no identifiers; failure never blocks the count.
            try {
              let meta = {};
              try { meta = JSON.parse((await req.text()) || "{}"); } catch (e2) {}
              const ua = req.headers.get("user-agent") || "";
              const device = /iPad|Tablet/i.test(ua) ? "tablet"
                : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
              const country = (req.cf && req.cf.country) || "";
              const clean = (v, n) => String(v ?? "").slice(0, n);
              const insertEvent = () => DB.prepare(
                "INSERT INTO events (at,kind,country,device,fmt,ftype,look,ctype,n) VALUES (?,?,?,?,?,?,?,?,?)")
                .bind(Date.now(), key, country, device, clean(meta.fmt, 16), clean(meta.ftype, 8),
                  clean(meta.look, 24), clean(meta.ctype, 8), Math.min(3, Math.max(1, +meta.n || 1))).run();
              try { await insertEvent(); }
              catch (e3) { // first event ever: the table creates itself
                await DB.prepare("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, country TEXT DEFAULT '', device TEXT DEFAULT '', fmt TEXT DEFAULT '', ftype TEXT DEFAULT '', look TEXT DEFAULT '', ctype TEXT DEFAULT '', n INTEGER DEFAULT 1)").run();
                await insertEvent();
              }
            } catch (e4) { /* the counter still counted */ }
          }
          return Response.json(await allStats(), { headers: CNT_CORS });
        }
        return Response.json(await allStats(), { headers: CNT_CORS });
      }

      // human-readable stats page — open trace.qrdurian.com/stats in a browser
      if (p === "/stats") {
        const totals = {};
        for (const r of (await DB.prepare("SELECT k, v FROM stats").all()).results || []) totals[r.k] = r.v;
        const since = Date.now() - 30 * 86400e3;
        const dims = [["country", "Country"], ["device", "Device"], ["fmt", "Canvas"], ["ftype", "File type"], ["look", "Look"], ["ctype", "Content type"]];
        let tables = "";
        try {
          for (const [col, label] of dims) {
            const rows = (await DB.prepare(
              `SELECT ${col} AS d, COUNT(*) AS c FROM events WHERE at > ? AND kind = 'downloads' GROUP BY ${col} ORDER BY c DESC LIMIT 10`)
              .bind(since).all()).results || [];
            if (!rows.length) continue;
            tables += `<h2>${label}</h2><div class="card">` +
              rows.map((r) => `<div class="kv"><span>${(r.d || "—")}</span><b>${r.c}</b></div>`).join("") + "</div>";
          }
        } catch (e5) { /* no events table yet */ }
        return page("qrdurian stats", `
          <h1>qrdurian stats</h1>
          <div class="card">
            <div class="kv"><span>QRs generated</span><b>${totals.qrs ?? 0}</b></div>
            <div class="kv"><span>Downloads</span><b>${totals.downloads ?? 0}</b></div>
            <div class="kv"><span>Shares</span><b>${totals.shares ?? 0}</b></div>
          </div>
          <p class="muted">Downloads, last 30 days — anonymous & coarse: no IPs, no QR contents, no identifiers.</p>
          ${tables || '<p class="muted">No detail events yet — they start collecting from the next download.</p>'}
        `);
      }

      // link shortener proxy for qrdurian.com — public shorteners don't send
      // CORS headers, so the browser can't call them; we can, server-side
      if (p === "/api/shorten") {
        if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CNT_CORS });
        const long = (url.searchParams.get("url") || "").slice(0, 2000);
        if (!/^https?:\/\/.{4,}/i.test(long)) {
          return Response.json({ error: "bad url" }, { status: 400, headers: CNT_CORS });
        }
        const ip = req.headers.get("cf-connecting-ip") || "?";
        if (rateLimitedCount(ip)) {
          return Response.json({ error: "rate limited" }, { status: 429, headers: CNT_CORS });
        }
        const r = await fetch("https://tinyurl.com/api-create.php?url=" + encodeURIComponent(long));
        const short = (await r.text()).trim();
        if (!r.ok || !/^https?:\/\/tinyurl\.com\//i.test(short)) {
          return Response.json({ error: "upstream failed" }, { status: 502, headers: CNT_CORS });
        }
        return Response.json({ short }, { headers: CNT_CORS });
      }

      // ---- trackable QRs: short redirect links with per-link scan stats ----
      // POST /api/track {url} → { short, stats }; GET /r/<id> counts + redirects;
      // GET /l/<secret> is the owner's private stats page (capability URL — no accounts)
      const ensureLinkTables = async () => {
        await DB.prepare("CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, url TEXT NOT NULL, secret TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, scans INTEGER NOT NULL DEFAULT 0)").run();
        await DB.prepare("CREATE TABLE IF NOT EXISTS link_scans (id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT NOT NULL, at INTEGER NOT NULL, country TEXT DEFAULT '', device TEXT DEFAULT '')").run();
      };
      if (p === "/api/track") {
        if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CNT_CORS });
        if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405, headers: CNT_CORS });
        let body = {};
        try { body = JSON.parse((await req.text()) || "{}"); } catch (e2) {}
        const dest = String(body.url || "").trim().slice(0, 2000);
        if (!/^https?:\/\/.{4,}/i.test(dest) || /^\s*(javascript|data|vbscript|file|blob):/i.test(dest)) {
          return Response.json({ error: "bad url" }, { status: 400, headers: CNT_CORS });
        }
        const ip = req.headers.get("cf-connecting-ip") || "?";
        if (rateLimitedCount(ip)) {
          return Response.json({ error: "rate limited" }, { status: 429, headers: CNT_CORS });
        }
        const id = shortId(7);
        const secret = crypto.randomUUID().replace(/-/g, "") + shortId(8);
        const insert = () => DB.prepare("INSERT INTO links (id, url, secret, created_at) VALUES (?,?,?,?)")
          .bind(id, dest, secret, Date.now()).run();
        try { await insert(); }
        catch (e3) { await ensureLinkTables(); await insert(); }
        return Response.json({
          short: `https://trace.qrdurian.com/r/${id}`,
          stats: `https://trace.qrdurian.com/l/${secret}`,
        }, { headers: CNT_CORS });
      }
      const rMatch = p.match(/^\/r\/([a-z0-9]{4,12})$/i);
      if (rMatch) {
        let link = null;
        try { link = await DB.prepare("SELECT * FROM links WHERE id=?").bind(rMatch[1]).first(); } catch (e2) {}
        if (!link) return page("Not found", "<h1>Link not recognised</h1><p>This tracked QR doesn't exist (or was mistyped).</p>", 404);
        // coarse anonymous scan event — same stance as /api/count: no IPs, no identifiers
        try {
          const ua = req.headers.get("user-agent") || "";
          const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
          await DB.prepare("UPDATE links SET scans=scans+1 WHERE id=?").bind(link.id).run();
          await DB.prepare("INSERT INTO link_scans (link_id, at, country, device) VALUES (?,?,?,?)")
            .bind(link.id, Date.now(), (req.cf && req.cf.country) || "", device).run();
        } catch (e3) { /* the redirect must never fail because of stats */ }
        return Response.redirect(link.url, 302);
      }
      const lMatch = p.match(/^\/l\/([a-z0-9]{30,50})$/i);
      if (lMatch) {
        let link = null;
        try { link = await DB.prepare("SELECT * FROM links WHERE secret=?").bind(lMatch[1]).first(); } catch (e2) {}
        if (!link) return page("Not found", "<h1>Stats link not recognised</h1><p>Check the bookmarked link from when you created the tracked QR.</p>", 404);
        const since30 = Date.now() - 30 * 86400e3;
        const dim = async (col) => {
          try {
            return (await DB.prepare(`SELECT ${col} AS d, COUNT(*) AS c FROM link_scans WHERE link_id=? AND at>? GROUP BY ${col} ORDER BY c DESC LIMIT 10`)
              .bind(link.id, since30).all()).results || [];
          } catch (e3) { return []; }
        };
        const daily = async () => {
          try {
            return (await DB.prepare("SELECT date(at/1000,'unixepoch') AS d, COUNT(*) AS c FROM link_scans WHERE link_id=? AND at>? GROUP BY d ORDER BY d DESC LIMIT 14")
              .bind(link.id, Date.now() - 14 * 86400e3).all()).results || [];
          } catch (e3) { return []; }
        };
        const kv = (rows) => rows.map((r) => `<div class="kv"><span>${esc(String(r.d || "—"))}</span><b>${r.c}</b></div>`).join("");
        const [byCountry, byDevice, byDay] = [await dim("country"), await dim("device"), await daily()];
        return page("Your QR stats", `
          <h1>Your QR stats</h1>
          <div class="hero ok"><div class="big">${link.scans}</div><p>total scans</p></div>
          <div class="card">
            <div class="kv"><span>Short link</span><b><code>trace.qrdurian.com/r/${esc(link.id)}</code></b></div>
            <div class="kv"><span>Opens</span><b style="word-break:break-all">${esc(link.url)}</b></div>
            <div class="kv"><span>Created</span><b>${new Date(link.created_at).toISOString().slice(0, 10)}</b></div>
          </div>
          ${byDay.length ? `<h2>Last 14 days</h2><div class="card">${kv(byDay)}</div>` : ""}
          ${byCountry.length ? `<h2>Country (30d)</h2><div class="card">${kv(byCountry)}</div>` : ""}
          ${byDevice.length ? `<h2>Device (30d)</h2><div class="card">${kv(byDevice)}</div>` : ""}
          <p class="muted">Scans are counted anonymously — country and device class only. Keep this page's link private: anyone with it can see these numbers.</p>
        `);
      }

      if (p === "/" || p === "") return landingPage();
      if (p === "/register") return registerPage();

      if (p === "/api/register" && req.method === "POST") {
        const f = await req.formData();
        const name = String(f.get("name") || "").slice(0, 80).trim();
        const phone = String(f.get("phone") || "").slice(0, 30).trim();
        const orchard = String(f.get("orchard") || "").slice(0, 100).trim();
        if (!name || !phone || !orchard) return registerPage("Please fill in all required fields.");
        const token = crypto.randomUUID().replace(/-/g, "") + shortId(8);
        await DB.prepare(
          "INSERT INTO farmers (token,name,phone,orchard,district,state,created_at,in_directory) VALUES (?,?,?,?,?,?,?,?)")
          .bind(token, name, phone, orchard,
            String(f.get("district") || "").slice(0, 80).trim(),
            String(f.get("state") || "Penang").slice(0, 40), Date.now(),
            f.get("directory") === "1" ? 1 : 0).run();
        return Response.redirect(`${origin}/farm/${token}?new=1`, 303);
      }

      const farmMatch = p.match(/^\/farm\/([a-z0-9]{30,50})$/);
      if (farmMatch) {
        const f = await DB.prepare("SELECT * FROM farmers WHERE token=?").bind(farmMatch[1]).first();
        if (!f) return page("Not found", "<h1>Link not recognised</h1><p>Check your bookmarked grower link, or <a href='/register'>register</a>.</p>", 404);
        const batches = (await DB.prepare("SELECT * FROM batches WHERE farmer_id=? ORDER BY created_at DESC").bind(f.id).all()).results;
        return farmPage(f, batches, origin, url.searchParams.get("new") === "1");
      }

      if (p === "/api/batch" && req.method === "POST") {
        const f = await req.formData();
        const farmer = await DB.prepare("SELECT * FROM farmers WHERE token=?").bind(String(f.get("token") || "")).first();
        if (!farmer) return page("Error", "<h1>Invalid grower link</h1>", 404);
        const variety = String(f.get("variety") || "").slice(0, 40);
        const harvest = String(f.get("harvest_date") || "").slice(0, 10);
        if (!VARIETIES.includes(variety) || !/^\d{4}-\d{2}-\d{2}$/.test(harvest)) {
          return page("Error", "<h1>Missing variety or harvest date</h1>", 400);
        }
        const id = shortId(8);
        let hasPhoto = 0;
        const photo = f.get("photo");
        if (env.PHOTOS && photo && typeof photo === "object" && photo.size > 0 && photo.size < 3_000_000 && (photo.type || "").startsWith("image/")) {
          await env.PHOTOS.put("p/" + id, photo.stream(), { httpMetadata: { contentType: photo.type } });
          hasPhoto = 1;
        }
        await DB.prepare(
          "INSERT INTO batches (id,farmer_id,variety,harvest_date,qty,notes,has_photo,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(id, farmer.id, variety, harvest,
            String(f.get("qty") || "").slice(0, 60).trim(),
            String(f.get("notes") || "").slice(0, 300).trim(), hasPhoto, Date.now()).run();
        return Response.redirect(`${origin}/farm/${farmer.token}/batch/${id}`, 303);
      }

      const batchMatch = p.match(/^\/farm\/([a-z0-9]{30,50})\/batch\/([a-z0-9]{6,12})$/);
      if (batchMatch) {
        const f = await DB.prepare("SELECT * FROM farmers WHERE token=?").bind(batchMatch[1]).first();
        if (!f) return page("Not found", "<h1>Link not recognised</h1>", 404);
        const b = await DB.prepare("SELECT * FROM batches WHERE id=? AND farmer_id=?").bind(batchMatch[2], f.id).first();
        if (!b) return page("Not found", "<h1>Batch not found</h1>", 404);
        return batchPage(f, b, origin);
      }

      const traceMatch = p.match(/^\/t\/([a-z0-9]{6,12})$/);
      if (traceMatch) {
        const b = await DB.prepare(
          `SELECT b.*, f.name fname, f.orchard, f.district, f.state, f.verified
           FROM batches b JOIN farmers f ON f.id=b.farmer_id WHERE b.id=?`).bind(traceMatch[1]).first();
        if (!b) return page("Unknown tag", `<div class="hero bad"><div class="big">❓</div><h1>Unknown tag</h1><p>This QR isn't registered with qrdurian trace.</p></div>`, 404);
        const now = Date.now();
        if (!b.first_scan_at) {
          await DB.prepare("UPDATE batches SET first_scan_at=?, scan_count=scan_count+1 WHERE id=?").bind(now, b.id).run();
          b.first_scan_at = now;
        } else {
          await DB.prepare("UPDATE batches SET scan_count=scan_count+1 WHERE id=?").bind(b.id).run();
        }
        b.scan_count += 1;
        await DB.prepare("INSERT INTO scans (batch_id, at, country) VALUES (?,?,?)")
          .bind(b.id, now, (req.cf && req.cf.country) || "").run();
        return scanPage(b, origin);
      }

      const photoMatch = p.match(/^\/p\/([a-z0-9]{6,12})$/);
      if (photoMatch && env.PHOTOS) {
        const obj = await env.PHOTOS.get("p/" + photoMatch[1]);
        if (!obj) return new Response("not found", { status: 404 });
        return new Response(obj.body, {
          headers: { "Content-Type": obj.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "public, max-age=86400" },
        });
      }

      if (p === "/map") {
        const growers = (await DB.prepare(
          `SELECT f.name, f.orchard, f.district, f.state, f.verified, f.demo, f.lat, f.lng, COUNT(b.id) nb
           FROM farmers f LEFT JOIN batches b ON b.farmer_id=f.id
           WHERE f.in_directory=1 AND f.lat IS NOT NULL GROUP BY f.id`).all()).results;
        const PX = (lon) => ((lon - MAP_PROJ.minLon) * MAP_PROJ.k).toFixed(1);
        const PY = (lat) => ((-lat - MAP_PROJ.minYv) * MAP_PROJ.k).toFixed(1);
        const TINTS = ["#E8F5D0", "#FFF3E0", "#F3E8FF", "#BAE6FD", "#FFE3EE", "#ECFDF5", "#FFF7E6", "#FDE68A"];
        const statePaths = Object.entries(MAP_STATES).map(([name, d], i) =>
          `<path d="${d}" fill="${TINTS[i % TINTS.length]}" stroke="#163300" stroke-width=".7" stroke-linejoin="round"/>`).join("");
        const pins = growers.map((g, i) => `
          <g class="pin" transform="translate(${PX(g.lng)},${PY(g.lat)})" data-i="${i}">
            <circle r="9" fill="#2E7D32" stroke="#163300" stroke-width="1.6"/>
            <circle r="3.2" fill="#FFE14D"/>
          </g>`).join("");
        const viewAll = `0 0 ${MAP_W} ${MAP_H}`;
        const viewPen = `${PX(99.4)} 0 ${(PX(105.4) - PX(99.4)).toFixed(0)} ${MAP_H}`;
        const viewBor = `${PX(109.3)} 60 ${(PX(119.5) - PX(109.3)).toFixed(0)} ${MAP_H - 60}`;
        return page("Durian map", `
  <h1>Durian map of Malaysia 🍈</h1>
  <p class="muted">Every pin is an orchard in the qrdurian trace directory. Tap a pin.</p>
  <div style="margin:8px 0">
    <button class="btn ghost vbtn" data-v="${viewPen}" style="padding:7px 13px;font-size:13px">Semenanjung</button>
    <button class="btn ghost vbtn" data-v="${viewBor}" style="padding:7px 13px;font-size:13px">Borneo</button>
    <button class="btn vbtn" data-v="${viewAll}" style="padding:7px 13px;font-size:13px">All</button>
  </div>
  <div class="card" style="padding:10px">
    <svg id="map" viewBox="${viewAll}" style="width:100%;display:block">
      ${statePaths}${pins}
    </svg>
  </div>
  <div class="card" id="info" hidden></div>
  <a class="btn" href="/register">Put my orchard on this map</a>
  <p class="muted"><a href="/growers">List view →</a></p>
  <script>
    const G=${JSON.stringify(growers.map((g) => ({ o: g.orchard, n: g.name, d: g.district, s: g.state, v: g.verified, nb: g.nb, demo: g.demo })))};
    const info=document.getElementById("info");
    document.querySelectorAll(".pin").forEach(pin=>{
      pin.style.cursor="pointer";
      pin.addEventListener("click",()=>{
        const g=G[+pin.dataset.i];
        info.hidden=false;
        info.innerHTML='<b style="font-family:Urbanist;font-size:17px">'+g.o+'</b> '+(g.v?'<span class="badge">✓ verified</span>':'')+(g.demo?' <span class="badge soft">demo</span>':'')+
          '<br><span class="muted">'+g.n+' · '+g.d+', '+g.s+' · '+g.nb+' batch'+(g.nb==1?'':'es')+'</span>';
        info.scrollIntoView({behavior:"smooth",block:"nearest"});
      });
    });
    document.querySelectorAll(".vbtn").forEach(b=>b.addEventListener("click",()=>{
      document.getElementById("map").setAttribute("viewBox",b.dataset.v);
      document.querySelectorAll(".vbtn").forEach(x=>x.classList.add("ghost"));
      b.classList.remove("ghost");
    }));
  </script>`);
      }

      if (p === "/growers") {
        const sel = url.searchParams.get("state") || "";
        const q = sel && STATES.includes(sel)
          ? DB.prepare(`SELECT f.name, f.orchard, f.district, f.state, f.verified, COUNT(b.id) nb
              FROM farmers f LEFT JOIN batches b ON b.farmer_id=f.id
              WHERE f.in_directory=1 AND f.state=? GROUP BY f.id ORDER BY f.verified DESC, nb DESC`).bind(sel)
          : DB.prepare(`SELECT f.name, f.orchard, f.district, f.state, f.verified, COUNT(b.id) nb
              FROM farmers f LEFT JOIN batches b ON b.farmer_id=f.id
              WHERE f.in_directory=1 GROUP BY f.id ORDER BY f.verified DESC, nb DESC`);
        const growers = (await q.all()).results;
        const chips = ["", ...STATES].map((s) =>
          `<a class="btn ${s === sel ? "" : "ghost"}" style="padding:7px 13px;font-size:13px;margin:4px 4px 0 0" href="/growers${s ? "?state=" + encodeURIComponent(s) : ""}">${s || "All"}</a>`).join("");
        const rows = growers.map((g) => `
          <div class="kv"><span><b>${esc(g.orchard)}</b><br><span class="muted">${esc(g.name)} · ${esc([g.district, g.state].filter(Boolean).join(", "))}</span></span>
          <span style="text-align:right">${g.verified ? '<span class="badge">✓ verified</span><br>' : ""}<span class="muted">${g.nb} batch${g.nb === 1 ? "" : "es"}</span></span></div>`).join("");
        return page("Growers directory", `
          <h1>Growers directory</h1>
          <p class="muted">Orchards registered with qrdurian trace. ✓ means we've confirmed the grower's identity.</p>
          <div>${chips}</div>
          <div class="card">${rows || `<p class="muted">No growers listed${sel ? " in " + esc(sel) : ""} yet — <a href="/register">be the first</a>.</p>`}</div>
          <a class="btn" href="/register">Register my orchard</a>
          <a class="btn ghost" href="/map">🗺 Map view</a>`);
      }

      if (p === "/admin") {
        if (url.searchParams.get("key") !== env.ADMIN_KEY || !env.ADMIN_KEY) return new Response("forbidden", { status: 403 });
        if (req.method === "POST") {
          const f = await req.formData();
          await DB.prepare("UPDATE farmers SET verified=? WHERE id=?")
            .bind(f.get("verified") === "1" ? 1 : 0, Number(f.get("id"))).run();
        }
        const farmers = (await DB.prepare(
          `SELECT f.*, COUNT(b.id) nb, COALESCE(SUM(b.scan_count),0) ns FROM farmers f
           LEFT JOIN batches b ON b.farmer_id=f.id GROUP BY f.id ORDER BY f.created_at DESC`).all()).results;
        const rows = farmers.map((x) => `
          <tr><td>${esc(x.name)}<br><span class="muted">${esc(x.phone)}</span></td>
          <td>${esc(x.orchard)}<br><span class="muted">${esc(x.district)} ${esc(x.state)}</span></td>
          <td>${x.nb} batches<br>${x.ns} scans</td>
          <td><form method="POST" action="/admin?key=${esc(env.ADMIN_KEY)}">
            <input type="hidden" name="id" value="${x.id}">
            <input type="hidden" name="verified" value="${x.verified ? 0 : 1}">
            <button class="btn ${x.verified ? "ghost" : ""}" style="margin:0;padding:8px 12px;font-size:12px">${x.verified ? "✓ verified" : "verify"}</button>
          </form></td></tr>`).join("");
        return page("Admin", `<h1>Growers</h1><div class="card"><table>${rows || "<tr><td>None yet</td></tr>"}</table></div>`);
      }

      return page("Not found", "<h1>404</h1><p><a href='/'>Home</a></p>", 404);
    } catch (e) {
      return page("Error", `<h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p>`, 500);
    }
  },
};
