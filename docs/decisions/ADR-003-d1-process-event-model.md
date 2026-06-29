# ADR 003: D1 schema and process event model

- Status: accepted
- Date: 2026-06-29
- Deciders: Technical owner
- Consulted: Orchestrator modules, existing D1 migrations

## Context
The orchestrator needs persistent state to track intake processes, extractions, and clarifications. This ADR defines the D1 schema.

## Schema

### orchestration_processes
Each intake creates one process record.

```sql
CREATE TABLE IF NOT EXISTS orchestration_processes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,                          -- FK to orders (nullable for new intakes)
  client_id INTEGER,                         -- FK to clients (nullable)
  input_modality TEXT NOT NULL DEFAULT 'unknown',  -- text|image|audio|pdf|mixed
  input_summary_json TEXT DEFAULT '{}',       -- normalized input summary
  context_json TEXT DEFAULT '{}',             -- session context (orderId, intent, etc.)
  status TEXT NOT NULL DEFAULT 'created',    -- state machine status
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
```

Status values: `created → classifying → extracting → clarifying → routing → completed | failed | timed_out`

### orchestration_steps
Audit trail for each state transition.

```sql
CREATE TABLE IF NOT EXISTS orchestration_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  process_id INTEGER NOT NULL REFERENCES orchestration_processes(id),
  step_type TEXT NOT NULL,                   -- status name or custom step
  status TEXT NOT NULL DEFAULT 'pending',    -- pending|completed|failed
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  error_message TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  completed_at TEXT
);
```

### orchestration_extractions
One per extraction attempt within a process.

```sql
CREATE TABLE IF NOT EXISTS orchestration_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  process_id INTEGER NOT NULL REFERENCES orchestration_processes(id),
  extraction_type TEXT NOT NULL,             -- text_analysis|image_analysis|audio_transcription|pdf_intelligence|multi_modal
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',    -- pending|running|completed|failed
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
```

### orchestration_clarifications
Questions sent to customer and their responses.

```sql
CREATE TABLE IF NOT EXISTS orchestration_clarifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  process_id INTEGER NOT NULL REFERENCES orchestration_processes(id),
  extraction_id INTEGER REFERENCES orchestration_extractions(id),
  question TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'blocking', -- blocking|nice_to_have
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending|sent|responded|timed_out|skipped
  sent_at TEXT,
  responded_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
```

## State machine
```
created ──→ classifying ──→ extracting ──→ clarifying ──→ routing ──→ completed
   │              │              │              │              │
   └──→ failed    └──→ failed    └──→ failed    └──→ failed    └──→ failed
                                              └──→ timed_out
```

Key transitions:
- `classifying → extracting`: input classified, extraction pipeline determined
- `extracting → clarifying`: extraction incomplete, questions needed
- `clarifying → extracting`: clarification received, re-extract with new data
- `extracting → routing`: extraction complete, ready for downstream
- `routing → completed`: downstream action executed

## Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_orch_processes_status ON orchestration_processes(status);
CREATE INDEX IF NOT EXISTS idx_orch_processes_order ON orchestration_processes(order_id);
CREATE INDEX IF NOT EXISTS idx_orch_steps_process ON orchestration_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_orch_extractions_process ON orchestration_extractions(process_id);
CREATE INDEX IF NOT EXISTS idx_orch_clarifications_process ON orchestration_clarifications(process_id);
```

## Migration
File: `packages/orchestrator/migrations/0009_orchestration_processes.sql`
Apply: `npm run db:migrate:local` (after build assembles migrations to .wrangler/dist/)
