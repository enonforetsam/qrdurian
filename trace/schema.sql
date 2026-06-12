-- qrdurian trace — D1 schema
CREATE TABLE IF NOT EXISTS farmers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,          -- capability URL secret
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  orchard TEXT NOT NULL,
  district TEXT DEFAULT '',
  state TEXT DEFAULT 'Penang',
  verified INTEGER DEFAULT 0,          -- admin-set; shows badge on scan pages
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,                 -- short public id used in /t/<id>
  farmer_id INTEGER NOT NULL REFERENCES farmers(id),
  variety TEXT NOT NULL,
  harvest_date TEXT NOT NULL,
  qty TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  has_photo INTEGER DEFAULT 0,
  first_scan_at INTEGER,               -- set on first consumer scan; expiry = +7 days
  scan_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  country TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_batches_farmer ON batches(farmer_id);
CREATE INDEX IF NOT EXISTS idx_scans_batch ON scans(batch_id);

-- qrdurian.com counters (created ad-hoc in prod; documented here)
-- keys: qrs (generates), downloads, shares
CREATE TABLE IF NOT EXISTS stats (
  k TEXT PRIMARY KEY,
  v INTEGER NOT NULL DEFAULT 0
);

-- anonymous download/share/generate events (coarse: country + device class +
-- design context; no IPs, no QR contents, no identifiers)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,        -- qrs | downloads | shares
  country TEXT DEFAULT '',   -- from Cloudflare's req.cf
  device TEXT DEFAULT '',    -- mobile | tablet | desktop (UA class)
  fmt TEXT DEFAULT '',       -- canvas: square | wallpaper | poster | story
  ftype TEXT DEFAULT '',     -- png | jpg | svg
  look TEXT DEFAULT '',      -- last applied look name
  ctype TEXT DEFAULT '',     -- url | wifi | mail | text
  n INTEGER DEFAULT 1        -- codes on the artboard
);
