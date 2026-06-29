-- Migration 0010: Idempotency and deduplication
-- Adds idempotency_keys table and idempotency_key columns

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  result_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_entity ON idempotency_keys(entity_type, created_at);

-- Add idempotency_key columns to existing tables
ALTER TABLE orchestration_processes ADD COLUMN idempotency_key TEXT;
ALTER TABLE orchestration_extractions ADD COLUMN idempotency_key TEXT;
ALTER TABLE orchestration_clarifications ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orch_processes_idempotency
  ON orchestration_processes(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orch_extractions_idempotency
  ON orchestration_extractions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orch_clarifications_idempotency
  ON orchestration_clarifications(idempotency_key) WHERE idempotency_key IS NOT NULL;
