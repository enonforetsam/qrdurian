/**
 * qrdurian backend — Cloudflare Worker + D1. Zero dependencies.
 * Free, no-signup, open-source. Powers qrdurian.com: usage counters
 * (/api/count, /stats), link shortener (/api/shorten), design short links
 * (/api/design, /d/<id>), and anonymous trackable QRs (/api/track, /r/<id>,
 * /l/<secret>). No accounts, no auth, no billing.
 *
 * Bindings: DB (D1). Optional var: SITE (design-link redirect origin).
 * (The earlier durian origin-verification "trace" program was retired 2026-06-13;
 *  its farmers/batches/scans tables are left intact but no longer served.)
 */

const BRAND = "qrdurian";
const MAIN = "https://qrdurian.com";

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
<p class="muted" style="margin-top:34px"><a href="${MAIN}">qrdurian.com</a> · free QR code designer</p>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

/* ---------------- pages ---------------- */

function landingPage() {
  return page("qrdurian — trackable QR codes", `
  <h1>Beautiful QR codes you can track 🍈</h1>
  <p>This is the engine behind <a href="${MAIN}">qrdurian.com</a> — the free QR designer.
  It also powers <b>trackable QRs</b>: short links that count every scan. No signup, no accounts.</p>
  <div class="card">
    <h2>Make a QR — free</h2>
    <p class="muted">Design a gorgeous QR in seconds. No signup, no watermark. Download PNG or SVG.</p>
    <a class="btn black" href="${MAIN}">Open qrdurian →</a>
  </div>
  <div class="card">
    <h2>Track a QR — free</h2>
    <p class="muted">Turn any link into a short, scan-counting QR. Anonymous & private — keep your stats link to see the numbers. No account needed.</p>
    <a class="btn" href="${MAIN}">Open qrdurian →</a>
  </div>`);
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
      const CNT_CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type", "Cache-Control": "no-store" };
      // blanket CORS preflight for every /api/* route (authed routes send an
      // Authorization header → the browser preflights; answer it once here)
      if (req.method === "OPTIONS" && p.startsWith("/api/")) return new Response(null, { status: 204, headers: CNT_CORS });
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
      // GET /l/<secret> is the private stats page (capability URL — no accounts).
      // Fully anonymous: anyone can create a tracked link, no sign-in.
      const ensureLinkTables = async () => {
        await DB.prepare("CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, url TEXT NOT NULL, secret TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, scans INTEGER NOT NULL DEFAULT 0)").run();
        await DB.prepare("CREATE TABLE IF NOT EXISTS link_scans (id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT NOT NULL, at INTEGER NOT NULL, country TEXT DEFAULT '', device TEXT DEFAULT '')").run();
        // legacy columns kept for schema compatibility; always inserted empty (lazy migration; ignore "duplicate column")
        for (const col of ["account TEXT DEFAULT ''", "editable INTEGER DEFAULT 0", "domain TEXT DEFAULT ''"]) {
          try { await DB.prepare(`ALTER TABLE links ADD COLUMN ${col}`).run(); } catch (e) {}
        }
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
        // anonymous: always empty account, editable=0, no custom domain
        const insert = () => DB.prepare("INSERT INTO links (id, url, secret, created_at, account, editable, domain) VALUES (?,?,?,?,?,?,?)")
          .bind(id, dest, secret, Date.now(), "", 0, "").run();
        try { await insert(); }
        catch (e3) { await ensureLinkTables(); await insert(); }
        const host = url.host;  // self-host (trace.qrdurian.com prod / trace-staging.qrdurian.com staging)
        return Response.json({
          short: `https://${host}/r/${id}`,
          stats: `https://${url.host}/l/${secret}`,
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
            <div class="kv"><span>Short link</span><b><code>${esc(url.host)}/r/${esc(link.id)}</code></b></div>
            <div class="kv"><span>Opens</span><b style="word-break:break-all">${esc(link.url)}</b></div>
            <div class="kv"><span>Created</span><b>${new Date(link.created_at).toISOString().slice(0, 10)}</b></div>
          </div>
          ${byDay.length ? `<h2>Last 14 days</h2><div class="card">${kv(byDay)}</div>` : ""}
          ${byCountry.length ? `<h2>Country (30d)</h2><div class="card">${kv(byCountry)}</div>` : ""}
          ${byDevice.length ? `<h2>Device (30d)</h2><div class="card">${kv(byDevice)}</div>` : ""}
          <p class="muted">Scans are counted anonymously — country and device class only. Keep this page's link private: anyone with it can see these numbers.</p>
        `);
      }

      // ---- pretty share links for qrdurian.com designs ----
      // POST /api/design {payload} stores the base64 design hash → short /d/<id>;
      // GET /d/<id> 302s to qrdurian.com/#d=<payload> (editor already boots from #d=).
      // The full #d= URL stays the zero-backend canonical; this is just a nicety.
      if (p === "/api/design") {
        if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CNT_CORS });
        if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405, headers: CNT_CORS });
        let body = {};
        try { body = JSON.parse((await req.text()) || "{}"); } catch (e2) {}
        const payload = String(body.payload || "");
        if (!/^[A-Za-z0-9_-]{8,8000}$/.test(payload)) { // base64url, sane length
          return Response.json({ error: "bad payload" }, { status: 400, headers: CNT_CORS });
        }
        const ip = req.headers.get("cf-connecting-ip") || "?";
        if (rateLimitedCount(ip)) return Response.json({ error: "rate limited" }, { status: 429, headers: CNT_CORS });
        const id = shortId(7);
        const insert = () => DB.prepare("INSERT INTO designs (id, payload, created_at) VALUES (?,?,?)")
          .bind(id, payload, Date.now()).run();
        try { await insert(); }
        catch (e3) {
          await DB.prepare("CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)").run();
          await insert();
        }
        return Response.json({ short: `https://${url.host}/d/${id}` }, { headers: CNT_CORS });
      }
      const dMatch = p.match(/^\/d\/([a-z0-9]{4,12})$/i);
      if (dMatch) {
        let row = null;
        try { row = await DB.prepare("SELECT payload FROM designs WHERE id=?").bind(dMatch[1]).first(); } catch (e2) {}
        if (!row) return page("Not found", "<h1>Design not found</h1><p>This share link doesn't exist (or was mistyped). <a href='https://qrdurian.com'>Make your own →</a></p>", 404);
        return Response.redirect(`${env.SITE || MAIN}/#d=${row.payload}`, 302);
      }

      if (p === "/" || p === "") return landingPage();

      return page("Not found", "<h1>404</h1><p><a href='/'>Home</a></p>", 404);
    } catch (e) {
      return page("Error", `<h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p>`, 500);
    }
  },
};
