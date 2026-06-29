-- 0006_ai_observability.sql
-- V2 Phase 4.5 Slice 5: AI observability foundation — ai_runs, ai_actions, ai_feedback.

CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_code TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  schema_version TEXT,
  input_summary_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  order_id INTEGER,
  engagement_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  action_code TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error_code TEXT,
  manager_override INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (run_id) REFERENCES ai_runs(id)
);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER,
  feedback_type TEXT NOT NULL,
  feedback_text TEXT,
  rating INTEGER,
  manager_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES ai_runs(id),
  FOREIGN KEY (action_id) REFERENCES ai_actions(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_module ON ai_runs(module_code);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_runs(status);
CREATE INDEX IF NOT EXISTS idx_ai_runs_order ON ai_runs(order_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_actions_run ON ai_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_run ON ai_feedback(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_feedback(feedback_type);
