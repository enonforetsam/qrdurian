# qrdurian trace

Durian origin verification — growers register harvest batches, attach beautiful
qrdurian QR tags to stems, consumers scan to verify orchard/variety/harvest date.
Anti-fake: a tag expires **7 days after its first scan**.

Built for the Penang pilot (2026 season). Cloudflare Worker + D1; photos via R2 (optional).

## Deploy

```bash
cd trace
npx wrangler login                                      # once
npx wrangler d1 create qrdurian-trace                   # paste database_id into wrangler.toml
npx wrangler d1 execute qrdurian-trace --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY                       # pick a long random string
npx wrangler deploy
# optional photos:
#   npx wrangler r2 bucket create qrdurian-photos  → uncomment r2 block → redeploy
# custom domain: uncomment routes → redeploy (zone qrdurian.com must be on this account)
```

## URLs

| Path | Who | What |
|---|---|---|
| `/` | public | landing — grower pitch + register link |
| `/register` | grower | self-serve signup (no password — capability link) |
| `/farm/<token>` | grower | private dashboard: create batches, see scans/status |
| `/farm/<token>/batch/<id>` | grower | trace link + "Design my tag on qrdurian" (pre-filled) |
| `/t/<id>` | consumer | scan page: verified-origin hero or expired warning |
| `/admin?key=…` | you | grower list, verify toggle (✓ badge on scan pages) |

## Notes

- Grower auth = capability URL (the `/farm/<token>` link **is** the login). Lost link →
  look up the token in D1 by phone and resend via WhatsApp.
- First scan stamps `first_scan_at`; preview scans count — growers are warned on the batch page.
- All input length-capped + escaped; tokens are 40 random chars; admin is a single secret.
- Free tier headroom: D1 5M reads/day — a pilot of hundreds of growers won't dent it.
