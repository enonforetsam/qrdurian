# qrdurian MCP server

Lets AI assistants (Claude, and anything else that speaks
[MCP](https://modelcontextprotocol.io)) design QR codes on qrdurian.com natively.

Two tools ~ **`design_qr`** takes friendly parameters (content, look, ink, texture,
caption, font, margin, scene background…) and returns a link that opens the finished
design in the editor; **`list_looks`** lists every curated look with a one-line
description so the assistant can pick the right vibe. No rendering, no storage,
no API keys: the link *is* the design.

## Deploy (Cloudflare Workers, free tier)

```bash
cd mcp
npx wrangler login      # once
npx wrangler deploy
```

`wrangler.toml` routes the worker to **`mcp.qrdurian.com`** (Cloudflare provisions
DNS + certificate on deploy since qrdurian.com is already on the account). The
`https://qrdurian-mcp.<account>.workers.dev` URL works too.

## Connect

The server URL is:

```
https://mcp.qrdurian.com/mcp
```

No auth, no API key ~ it only builds qrdurian.com links.

**claude.ai (custom connector)**
1. claude.ai → Settings → **Connectors** → **Add custom connector**
2. Name: `qrdurian` · URL: `https://mcp.qrdurian.com/mcp`
3. Leave OAuth fields empty (the server is open) and add.
4. In a chat, enable the connector under the tools menu, then ask for a QR.

**Claude Code**
```bash
claude mcp add --transport http qrdurian https://mcp.qrdurian.com/mcp
```

**Claude Desktop** (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "qrdurian": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.qrdurian.com/mcp"]
    }
  }
}
```

Then ask: *"Make me a QR for my café's Wi-Fi, matcha look, caption FREE WIFI."*

## Guardrails

- **Stateless by construction** — no storage, no secrets, no env vars, no outbound fetches,
  zero dependencies. The only capability is string-building a qrdurian.com link.
- **Rate limited** — 30 requests/IP/minute (best-effort per isolate), 429 beyond.
- **Size-capped** — 8KB request bodies, max 5 messages per JSON-RPC batch.
- **Input sanitized** — control characters stripped, lengths capped, colors/enums
  whitelisted; `javascript:` / `data:` / `vbscript:` / `file:` / `blob:` content refused.
- **Response hygiene** — `no-store`, `nosniff`; tool output is a fixed template (no
  third-party content can ride through it).
- **No logging of user content** — designs pass through, nothing is recorded.

## Notes

- The looks table mirrors `LOOKS` in `../index.html` ~ keep them in sync (names + one-line descriptions).
- Stateless JSON-RPC over HTTP (streamable-HTTP transport, no sessions, no SSE needed).
- The full URL parameter schema lives in [`../API.md`](../API.md).
