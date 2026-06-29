-- 0008_package_c_and_share_links.sql
-- V2 Phase 4.6: Package C model, project files registry, share links.

CREATE TABLE IF NOT EXISTS project_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  engagement_id INTEGER NOT NULL,
  deliverable_id INTEGER,
  file_type TEXT NOT NULL,
  file_role TEXT NOT NULL DEFAULT 'primary',
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  download_allowed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (engagement_id) REFERENCES order_package_engagements(id)
);

CREATE TABLE IF NOT EXISTS project_share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  engagement_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'view',
  expires_at TEXT NOT NULL,
  download_enabled INTEGER NOT NULL DEFAULT 0,
  comment_enabled INTEGER NOT NULL DEFAULT 0,
  approval_enabled INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (engagement_id) REFERENCES order_package_engagements(id)
);

CREATE TABLE IF NOT EXISTS project_share_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (share_link_id) REFERENCES project_share_links(id)
);

CREATE INDEX IF NOT EXISTS idx_proj_files_order ON project_files(order_id);
CREATE INDEX IF NOT EXISTS idx_proj_files_engagement ON project_files(engagement_id);
CREATE INDEX IF NOT EXISTS idx_proj_files_type ON project_files(file_type);
CREATE INDEX IF NOT EXISTS idx_proj_files_mime ON project_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_share_links_order ON project_share_links(order_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON project_share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_share_links_engagement ON project_share_links(engagement_id);
CREATE INDEX IF NOT EXISTS idx_share_comments_link ON project_share_comments(share_link_id);
