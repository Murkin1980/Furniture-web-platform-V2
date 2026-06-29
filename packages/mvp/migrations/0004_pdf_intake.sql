-- 0004_pdf_intake.sql
-- V2 Phase 3: PDF intake — uploads, manifests, drafts, estimates, review gate.

CREATE TABLE IF NOT EXISTS pdf_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  engagement_id INTEGER,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  page_count INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  source TEXT NOT NULL DEFAULT 'order_admin',
  uploaded_by TEXT NOT NULL DEFAULT 'manager',
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS pdf_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER,
  order_id INTEGER NOT NULL,
  engagement_id INTEGER,
  manifest_version TEXT NOT NULL DEFAULT 'project-pdf-manifest/v1',
  manifest_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  ai_provider TEXT,
  ai_model TEXT,
  processing_time_ms INTEGER,
  analysis_version TEXT,
  error TEXT,
  created_by TEXT NOT NULL DEFAULT 'manager',
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (upload_id) REFERENCES pdf_uploads(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS pdf_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  estimate_version TEXT NOT NULL DEFAULT 'pdf-estimate/v1',
  estimate_json TEXT NOT NULL DEFAULT '{}',
  total_kzt INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES pdf_drafts(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_pdf_uploads_order_id ON pdf_uploads(order_id);
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_status ON pdf_uploads(status);
CREATE INDEX IF NOT EXISTS idx_pdf_drafts_order_id ON pdf_drafts(order_id);
CREATE INDEX IF NOT EXISTS idx_pdf_drafts_upload_id ON pdf_drafts(upload_id);
CREATE INDEX IF NOT EXISTS idx_pdf_drafts_status ON pdf_drafts(status);
CREATE INDEX IF NOT EXISTS idx_pdf_estimates_draft_id ON pdf_estimates(draft_id);
CREATE INDEX IF NOT EXISTS idx_pdf_estimates_order_id ON pdf_estimates(order_id);
