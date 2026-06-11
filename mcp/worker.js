/**
 * qrdurian MCP server — Cloudflare Worker, zero dependencies.
 * Speaks MCP (JSON-RPC over streamable HTTP) and exposes one tool, design_qr,
 * which constructs a qrdurian.com design link. No rendering, no storage.
 *
 * Deploy:  npx wrangler deploy
 * Connect: claude mcp add --transport http qrdurian https://<worker-url>/mcp
 */

const SITE = "https://qrdurian.com";

// keep in sync with THEMES in index.html
const THEMES = {
  durian:    { f: "#18181b", b: "#ffffff", g: "#FFE14D", o: "#18181b", x: "waves" },
  matcha:    { f: "#163300", b: "#E8F5D0", g: "#9FE870", o: "#163300", x: "leaves" },
  midnight:  { f: "#163300", b: "#9FE870", g: "#0B1F00", o: "#9FE870", x: "topo" },
  ocean:     { f: "#0B2942", b: "#ffffff", g: "#8ED6F0", o: "#0B2942", x: "waves" },
  berry:     { f: "#4A0E2E", b: "#FFE3EE", g: "#EC4899", o: "#4A0E2E", x: "dots" },
  tangerine: { f: "#5A1C00", b: "#FFF3E0", g: "#F97316", o: "#5A1C00", x: "stripes" },
  mono:      { f: "#101113", b: "#ffffff", g: "#E6E6E3", o: "#101113", x: "grid", i: "stamp" },
  lavender:  { f: "#2E1065", b: "#F3E8FF", g: "#A78BFA", o: "#2E1065", x: "hex" },
  sky:       { f: "#0C4A6E", b: "#ffffff", g: "#BAE6FD", o: "#0C4A6E", x: "crosses" },
  sunset:    { f: "#4C1D95", b: "#FFF7E6", g: "#FDBA74", o: "#4C1D95", x: "spikes", i: "brush" },
  mint:      { f: "#064E3B", b: "#ECFDF5", g: "#6EE7B7", o: "#064E3B", x: "dots" },
  paper:     { f: "#1C1917", b: "#ffffff", g: "#F5F0E6", o: "#1C1917", x: "topo", i: "stamp" },
};
const TEXTURES = ["none", "durians", "topo", "dots", "grid", "stripes", "waves", "crosses", "spikes", "leaves", "hex"];
const INKS = ["press", "stamp", "brush"];
const FORMATS = ["square", "wallpaper", "poster", "story"];
const CORNERS = { rounded: "extra-rounded", circle: "dot", square: "square" };

const TOOL = {
  name: "design_qr",
  description:
    "Create a beautiful, ink-styled QR code design on qrdurian.com. Returns a link that opens " +
    "the finished design in the editor, where the user can tweak it and download PNG/SVG. " +
    "Always scannable. Prefer a `theme` for guaranteed-good colors; individual color params override it. " +
    "Useful contents: URLs, wa.me/<phone> WhatsApp links, WIFI:T:WPA;S:<ssid>;P:<password>;; payloads, mailto:, plain text.",
  inputSchema: {
    type: "object",
    required: ["content"],
    properties: {
      content: { type: "string", maxLength: 2000, description: "What scanning the QR opens (URL, text, WIFI: payload, wa.me link…)" },
      theme: { type: "string", enum: Object.keys(THEMES), description: "Curated palette + texture + ink mood" },
      ink: { type: "string", enum: INKS, description: "Ink rendering: press=clean, stamp=heavy, brush=dry streaks" },
      texture: { type: "string", enum: TEXTURES, description: "Repeating background pattern" },
      caption: { type: "string", maxLength: 80, description: "Short label under the code, e.g. SCAN ME" },
      format: { type: "string", enum: FORMATS, description: "Export size: square 2048², wallpaper 1290×2796, poster A4 300DPI, story 1080×1920" },
      corner: { type: "string", enum: Object.keys(CORNERS), description: "Finder-eye style" },
      fg: { type: "string", description: "Module ink color, 6-digit hex (overrides theme)" },
      base: { type: "string", description: "Card-behind-the-code color, hex" },
      bg: { type: "string", description: "Page/scene background color, hex" },
      outline_color: { type: "string", description: "QR outline ring color, hex" },
      outline_width: { type: "integer", minimum: 0, maximum: 10, description: "Outline thickness, 0 = none (default 7)" },
    },
  },
};

function hex(v) {
  if (typeof v !== "string") return null;
  const h = v.replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(h) ? "#" + h.toLowerCase() : null;
}

function designURL(a) {
  const t = THEMES[a.theme] || THEMES.durian;
  const d = {
    u: String(a.content).slice(0, 2000),
    f: hex(a.fg) || t.f,
    b: hex(a.base) || t.b,
    g: hex(a.bg) || t.g,
    o: hex(a.outline_color) || t.o,
    x: TEXTURES.includes(a.texture) ? a.texture : t.x,
    i: INKS.includes(a.ink) ? a.ink : (t.i || "press"),
    w: Number.isInteger(a.outline_width) ? Math.max(0, Math.min(10, a.outline_width)) : 7,
    m: 2,
    s: "gradient",
    z: FORMATS.includes(a.format) ? a.format : "square",
    c: CORNERS[a.corner] || "extra-rounded",
    n: typeof a.caption === "string" ? a.caption.slice(0, 80) : "SCAN ME",
  };
  d.t = d.f; // caption color follows ink
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(d))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${SITE}/#d=${b64}`;
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
          "where the user can tweak and download it. Pick a theme matching the user's brand or mood.",
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
      const url = designURL(a);
      const theme = THEMES[a.theme] ? a.theme : "durian";
      return rpcResult(id, {
        content: [{
          type: "text",
          text:
            `QR design ready — theme "${theme}", ink "${a.ink || (THEMES[theme].i || "press")}".\n\n` +
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
};

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "POST" && (url.pathname === "/mcp" || url.pathname === "/")) {
      let body;
      try { body = await req.json(); } catch {
        return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
      }
      const messages = Array.isArray(body) ? body : [body];
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
