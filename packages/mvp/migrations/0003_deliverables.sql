-- 0003_deliverables.sql
-- V2 Phase 2: управляемый визуал — deliverables, render artifacts, revision rounds.

CREATE TABLE IF NOT EXISTS package_deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  deliverable_type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  artifact_url TEXT,
  artifact_format TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (engagement_id) REFERENCES order_package_engagements(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS deliverable_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  requested_by TEXT NOT NULL DEFAULT 'manager',
  request_note TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolution TEXT,
  FOREIGN KEY (deliverable_id) REFERENCES package_deliverables(id)
);

CREATE INDEX IF NOT EXISTS idx_deliverables_engagement_id ON package_deliverables(engagement_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_order_id ON package_deliverables(order_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON package_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_type ON package_deliverables(deliverable_type);
CREATE INDEX IF NOT EXISTS idx_revisions_deliverable_id ON deliverable_revisions(deliverable_id);
