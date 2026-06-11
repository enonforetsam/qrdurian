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

const DURIAN_SVG = `<svg class="logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 4.9L19.39 8.2L24.1 7.85L24.57 12.55L28.41 15.31L25.75 19.22L26.91 23.8L22.36 25.08L20.31 29.34L16 27.4L11.69 29.34L9.64 25.08L5.09 23.8L6.25 19.22L3.59 15.31L7.43 12.55L7.9 7.85L12.61 8.2Z" fill="#9FE870" stroke="#9FE870" stroke-width="2" stroke-linejoin="round"/><path d="M16 6.2 C16 4.4 15.5 3.1 14.4 2.2" fill="none" stroke="#163300" stroke-width="2.4" stroke-linecap="round"/></svg>`;

function page(title, body) {
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
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
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

/* ---------------- router ---------------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const origin = url.origin;
    const DB = env.DB;

    try {
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
          "INSERT INTO farmers (token,name,phone,orchard,district,state,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(token, name, phone, orchard,
            String(f.get("district") || "").slice(0, 80).trim(),
            String(f.get("state") || "Penang").slice(0, 40), Date.now()).run();
        return Response.redirect(`${origin}/farm/${token}?new=1`, 303);
      }

      const farmMatch = p.match(/^\/farm\/([a-z0-9]{30,50})$/);
      if (farmMatch) {
        const f = await DB.prepare("SELECT * FROM farmers WHERE token=?").bind(farmMatch[1]).first();
        if (!f) return page("Not found", "<h1>Link not recognised</h1><p>Check your bookmarked grower link, or <a href='/register'>register</a>.</p>");
        const batches = (await DB.prepare("SELECT * FROM batches WHERE farmer_id=? ORDER BY created_at DESC").bind(f.id).all()).results;
        return farmPage(f, batches, origin, url.searchParams.get("new") === "1");
      }

      if (p === "/api/batch" && req.method === "POST") {
        const f = await req.formData();
        const farmer = await DB.prepare("SELECT * FROM farmers WHERE token=?").bind(String(f.get("token") || "")).first();
        if (!farmer) return page("Error", "<h1>Invalid grower link</h1>");
        const variety = String(f.get("variety") || "").slice(0, 40);
        const harvest = String(f.get("harvest_date") || "").slice(0, 10);
        if (!VARIETIES.includes(variety) || !/^\d{4}-\d{2}-\d{2}$/.test(harvest)) {
          return page("Error", "<h1>Missing variety or harvest date</h1>");
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
        if (!f) return page("Not found", "<h1>Link not recognised</h1>");
        const b = await DB.prepare("SELECT * FROM batches WHERE id=? AND farmer_id=?").bind(batchMatch[2], f.id).first();
        if (!b) return page("Not found", "<h1>Batch not found</h1>");
        return batchPage(f, b, origin);
      }

      const traceMatch = p.match(/^\/t\/([a-z0-9]{6,12})$/);
      if (traceMatch) {
        const b = await DB.prepare(
          `SELECT b.*, f.name fname, f.orchard, f.district, f.state, f.verified
           FROM batches b JOIN farmers f ON f.id=b.farmer_id WHERE b.id=?`).bind(traceMatch[1]).first();
        if (!b) return page("Unknown tag", `<div class="hero bad"><div class="big">❓</div><h1>Unknown tag</h1><p>This QR isn't registered with qrdurian trace.</p></div>`);
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

      return page("Not found", "<h1>404</h1><p><a href='/'>Home</a></p>");
    } catch (e) {
      return page("Error", `<h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p>`);
    }
  },
};
