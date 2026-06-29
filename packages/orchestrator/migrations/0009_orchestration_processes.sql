-- Migration 0009: Orchestration process tracking
-- Tracks AI-first intake processes, extractions, and clarifications

CREATE TABLE IF NOT EXISTS orchestration_processes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  client_id INTEGER,
  input_modality TEXT NOT NULL DEFAULT 'unknown',
  input_summary_json TEXT DEFAULT '{}',
  context_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS orchestration_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  process_id INTEGER NOT NULL REFERENCES orchestration_processes(id),
  step_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  error_message TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS orchestration_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  process_id INTEGER NOT NULL REFERENCES orchestration_processes(id),
  extraction_type TEXT NOT NULL,
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS orchestration_clarifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  process_id INTEGER NOT NULL REFERENCES orchestration_processes(id),
  extraction_id INTEGER REFERENCES orchestration_extractions(id),
  question TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'blocking',
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  responded_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_orch_processes_status ON orchestration_processes(status);
CREATE INDEX IF NOT EXISTS idx_orch_processes_order ON orchestration_processes(order_id);
CREATE INDEX IF NOT EXISTS idx_orch_steps_process ON orchestration_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_orch_extractions_process ON orchestration_extractions(process_id);
CREATE INDEX IF NOT EXISTS idx_orch_clarifications_process ON orchestration_clarifications(process_id);
