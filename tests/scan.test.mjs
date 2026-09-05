// QRDurian ~ the promise is "it scans". This test loads index.html in headless
// Chrome, applies every look through the app's own UI, and asserts the app's
// scan check (jsQR decoding the rendered artwork offscreen) reports a scan.
// No npm dependencies: Node's built-in WebSocket drives Chrome over CDP.
// Run: npm test   (CHROME=/path/to/chrome to override the binary)
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHROME = process.env.CHROME || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium",
].find((p) => existsSync(p));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

// tiny static server for the repo root (file:// would block some canvas reads)
function serve() {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      const path = req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0];
      try {
        const body = readFileSync(join(ROOT, path));
        res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404); res.end();
      }
    }).listen(0, "127.0.0.1", () => resolve({ srv, port: srv.address().port }));
  });
}

async function launchChrome(port) {
  const profile = mkdtempSync(join(tmpdir(), "qrd-"));
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--window-size=1440,1000",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return { proc, ws: page.webSocketDebuggerUrl };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill(); throw new Error("Chrome did not start");
}

function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ready = new Promise((r) => ws.addEventListener("open", r));
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  };
  return { ready, send, evaluate, close: () => ws.close() };
}

test("every look scans", { timeout: 180_000 }, async (t) => {
  assert.ok(CHROME, "Chrome not found; set CHROME=/path/to/chrome");
  const { srv, port: httpPort } = await serve();
  const { proc, ws } = await launchChrome(9333 + Math.floor(Math.random() * 500));
  const c = cdp(ws); await c.ready;
  t.after(() => { c.close(); proc.kill(); srv.close(); });
  await c.send("Page.enable");
  await c.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/` });
  // wait for the app: the looks strip is populated by script
  await c.evaluate(`new Promise((res, rej) => { let n = 0; const t = setInterval(() => {
      if (document.querySelectorAll('#looksStrip .look').length > 0) { clearInterval(t); res(); }
      if (++n > 100) { clearInterval(t); rej(new Error('looks strip never populated')); } }, 100); })`);
  const looks = await c.evaluate(`[...document.querySelectorAll('#looksStrip .look')].map(b => b.dataset.theme)`);
  assert.ok(looks.length >= 19, `expected ≥19 looks, got ${looks.length}`);
  const failures = [];
  for (const name of looks) {
    const badge = await c.evaluate(`new Promise((res) => {
      const b = document.querySelector('#looksStrip .look[data-theme="${name}"]');
      const badge = document.getElementById('scanBadge');
      badge.textContent = '';
      b.click();
      let n = 0; const t = setInterval(() => {
        const txt = badge.textContent.trim();
        if (txt) { clearInterval(t); res(txt); }
        if (++n > 80) { clearInterval(t); res('(no badge after 8s)'); } }, 100); })`);
    if (!/Scans/.test(badge) || /May not/.test(badge)) failures.push(`${name}: ${badge}`);
  }
  assert.deepEqual(failures, [], "looks that did not scan:\n" + failures.join("\n"));
});

test("share-hash keys are documented in API.md", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const api = readFileSync(join(ROOT, "API.md"), "utf8");
  const keys = new Set([...html.matchAll(/hash key `([a-z])`/g)].map((m) => m[1]));
  for (const k of keys) assert.ok(api.includes("`" + k + "`") || api.includes(k + "="), `hash key ${k} missing from API.md`);
});
