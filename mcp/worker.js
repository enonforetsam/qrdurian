/**
 * qrdurian MCP server — Cloudflare Worker, zero dependencies.
 * Speaks MCP (JSON-RPC over streamable HTTP) and exposes one tool, design_qr,
 * which constructs a qrdurian.com design link. No rendering, no storage.
 *
 * Deploy:  npx wrangler deploy
 * Connect: claude mcp add --transport http qrdurian https://<worker-url>/mcp
 */

const SITE = "https://qrdurian.com";

// keep in sync with LOOKS in index.html — the names are the contract; the site
// resolves each name to its full design (palette, texture, ink, corners,
// caption, even a center logo for the dressed looks)
const LOOKS = [
  // palette looks
  "durian", "matcha", "midnight", "ocean", "berry", "tangerine",
  "mono", "lavender", "sky", "sunset", "mint", "paper",
  // dressed looks — arrive with a fitting caption + center logo
  "kopitiam", "makan", "pay", "wifi", "wedding", "music", "receipt", "neon",
];
const TEXTURES = ["none", "durians", "topo", "dots", "grid", "stripes", "waves", "crosses", "spikes", "leaves", "hex"];
const INKS = ["press", "stamp", "brush"];
const FORMATS = ["square", "wallpaper", "poster", "story"];
const CORNERS = ["rounded", "circle", "square"];
const DOTS = ["rounded", "dots", "square"];

const TOOL = {
  name: "design_qr",
  description:
    "Create a beautiful, ink-styled QR code design on qrdurian.com. Returns a link that opens " +
    "the finished design in the editor, where the user can tweak it and download PNG/SVG. " +
    "Always scannable. Prefer a `look` — a complete curated design. Dressed looks (kopitiam, makan, " +
    "pay, wifi, wedding, music, receipt, neon) also arrive with a fitting caption + center logo; " +
    "individual params override the look. " +
    "Useful contents: URLs, wa.me/<phone> WhatsApp links, WIFI:T:WPA;S:<ssid>;P:<password>;; payloads, mailto:, plain text.",
  inputSchema: {
    type: "object",
    required: ["content"],
    properties: {
      content: { type: "string", maxLength: 2000, description: "What scanning the QR opens (URL, text, WIFI: payload, wa.me link…)" },
      look: { type: "string", enum: LOOKS, description: "Complete curated design: palette + texture + ink + corners; dressed looks add caption + logo" },
      ink: { type: "string", enum: INKS, description: "Ink rendering: press=clean, stamp=heavy, brush=dry streaks" },
      texture: { type: "string", enum: TEXTURES, description: "Repeating background pattern" },
      caption: { type: "string", maxLength: 80, description: "Short label under the code, e.g. SCAN ME (overrides the look's)" },
      format: { type: "string", enum: FORMATS, description: "Export size: square 2048², wallpaper 1290×2796, poster A4 300DPI, story 1080×1920" },
      corner: { type: "string", enum: CORNERS, description: "Finder-eye style" },
      dot: { type: "string", enum: DOTS, description: "Module (data dot) shape" },
      fg: { type: "string", description: "Module ink color, 6-digit hex (overrides look)" },
      base: { type: "string", description: "Card-behind-the-code color, hex" },
      bg: { type: "string", description: "Page/scene background color, hex" },
      outline_color: { type: "string", description: "QR outline ring color, hex" },
      outline_width: { type: "integer", minimum: 0, maximum: 10, description: "Outline thickness, 0 = none (default 7)" },
    },
  },
};

// ---------------- guardrails ----------------
const MAX_BODY_BYTES = 8192;     // a design_qr call is well under 4KB
const MAX_BATCH = 5;             // JSON-RPC batch cap
const RATE_LIMIT = 30;           // requests per IP per minute (per isolate, best-effort)
const BLOCKED_SCHEMES = /^\s*(javascript|data|vbscript|file|blob):/i;

const rlBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = rlBuckets.get(ip);
  if (!b || now - b.ts > 60_000) {
    rlBuckets.set(ip, { ts: now, n: 1 });
    if (rlBuckets.size > 5000) rlBuckets.clear(); // memory cap
    return false;
  }
  b.n++;
  return b.n > RATE_LIMIT;
}

function clean(v, max) {
  // strip control characters, hard length cap
  return String(v).replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

function hex(v) {
  if (typeof v !== "string") return null;
  const h = v.replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(h) ? "#" + h.toLowerCase() : null;
}

function lookOf(a) {
  const name = a.look || a.theme; // theme accepted as legacy alias
  return LOOKS.includes(name) ? name : "durian";
}
function designURL(a) {
  // query-param form (not the #d= hash): the site resolves the look name itself,
  // so dressed looks keep their caption + center logo — hashes can't carry logos
  const p = new URLSearchParams();
  p.set("data", clean(a.content, 2000));
  p.set("look", lookOf(a));
  if (INKS.includes(a.ink)) p.set("ink", a.ink);
  if (TEXTURES.includes(a.texture)) p.set("texture", a.texture);
  if (typeof a.caption === "string") p.set("caption", clean(a.caption, 80));
  if (FORMATS.includes(a.format)) p.set("format", a.format);
  if (CORNERS.includes(a.corner)) p.set("corner", a.corner);
  if (DOTS.includes(a.dot)) p.set("dot", a.dot);
  const h = (k, v) => { const c = hex(v); if (c) p.set(k, c.slice(1)); };
  h("fg", a.fg); h("base", a.base); h("bg", a.bg); h("outline", a.outline_color);
  if (Number.isInteger(a.outline_width)) p.set("outlinew", Math.max(0, Math.min(10, a.outline_width)));
  return `${SITE}/?${p.toString()}`;
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRpc(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: params?.protocolVersion || "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "qrdurian", version: "1.0.0" },
        instructions:
          "Use design_qr to create QR code designs. The returned link opens the design on qrdurian.com " +
          "where the user can tweak and download it. Pick a look matching the user's purpose or mood — " +
          "dressed looks (kopitiam, pay, wifi, wedding…) come with a fitting caption and logo.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: [TOOL] });
    case "tools/call": {
      if (params?.name !== "design_qr") return rpcError(id, -32602, "Unknown tool: " + params?.name);
      const a = params.arguments || {};
      if (!a.content || typeof a.content !== "string") {
        return rpcResult(id, { content: [{ type: "text", text: "Error: `content` (what the QR opens) is required." }], isError: true });
      }
      if (BLOCKED_SCHEMES.test(a.content)) {
        return rpcResult(id, { content: [{ type: "text", text: "Error: that content scheme is not allowed in QR codes (javascript:/data:/file: are blocked for safety)." }], isError: true });
      }
      const url = designURL(a);
      return rpcResult(id, {
        content: [{
          type: "text",
          text:
            `QR design ready — look "${lookOf(a)}".\n\n` +
            `Open, tweak & download: ${url}\n\n` +
            `The link contains the entire design (nothing stored server-side). The user can change ` +
            `colors/texture/ink in the editor and export PNG (print-ready) or SVG.`,
        }],
      });
    }
    default:
      if (method?.startsWith("notifications/")) return null; // acknowledged, no response body
      return rpcError(id, -32601, "Method not found: " + method);
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "POST" && (url.pathname === "/mcp" || url.pathname === "/")) {
      // guardrail: per-IP rate limit (best-effort, per isolate)
      const ip = req.headers.get("cf-connecting-ip") || "unknown";
      if (rateLimited(ip)) {
        return Response.json(rpcError(null, -32000, "Rate limit exceeded — try again in a minute."), { status: 429, headers: CORS });
      }
      // guardrail: body size cap before parsing
      const raw = await req.text();
      if (raw.length > MAX_BODY_BYTES) {
        return Response.json(rpcError(null, -32600, "Request too large"), { status: 413, headers: CORS });
      }
      let body;
      try { body = JSON.parse(raw); } catch {
        return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
      }
      const messages = Array.isArray(body) ? body : [body];
      if (messages.length > MAX_BATCH) {
        return Response.json(rpcError(null, -32600, "Batch too large"), { status: 400, headers: CORS });
      }
      const replies = (await Promise.all(messages.map(handleRpc))).filter(Boolean);
      if (!replies.length) return new Response(null, { status: 202, headers: CORS });
      return Response.json(Array.isArray(body) ? replies : replies[0], {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // friendly landing for humans
    return new Response(
      "qrdurian MCP server — POST JSON-RPC to /mcp\n" +
      "Connect: claude mcp add --transport http qrdurian " + url.origin + "/mcp\n" +
      "Docs: https://github.com/enonforetsam/qrdurian/blob/main/API.md\n",
      { headers: { ...CORS, "Content-Type": "text/plain" } },
    );
  },
};
