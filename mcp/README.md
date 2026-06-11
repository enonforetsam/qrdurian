# qrdurian MCP server

Lets AI assistants (Claude, and anything else that speaks
[MCP](https://modelcontextprotocol.io)) design QR codes on qrdurian.com natively.

One tool — **`design_qr`** — takes friendly parameters (content, theme, ink, texture,
caption…) and returns a link that opens the finished design in the editor. No rendering,
no storage, no API keys: the link *is* the design.

## Deploy (Cloudflare Workers, free tier)

```bash
cd mcp
npx wrangler login      # once
npx wrangler deploy
```

You'll get `https://qrdurian-mcp.<account>.workers.dev`. Optionally attach
`mcp.qrdurian.com` as a custom domain (uncomment the route in `wrangler.toml`).

## Connect

**Claude Code**
```bash
claude mcp add --transport http qrdurian https://qrdurian-mcp.<account>.workers.dev/mcp
```

**Claude Desktop** (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "qrdurian": {
      "command": "npx",
      "args": ["mcp-remote", "https://qrdurian-mcp.<account>.workers.dev/mcp"]
    }
  }
}
```

Then ask: *"Make me a QR for my café's Wi-Fi, matcha theme, caption FREE WIFI."*

## Notes

- The theme table mirrors `THEMES` in `../index.html` — keep them in sync.
- Stateless JSON-RPC over HTTP (streamable-HTTP transport, no sessions, no SSE needed).
- The full URL parameter schema lives in [`../API.md`](../API.md).
