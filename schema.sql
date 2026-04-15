-- D1 schema for japanese-learning gojuon checklist
-- Run this ONCE in CF Dashboard -> D1 -> gojuon-progress -> Console after deploy.
-- Drops the old quiz tables and creates the new single-table learned_kana.

DROP TABLE IF EXISTS kana_progress;
DROP TABLE IF EXISTS quiz_sessions;

CREATE TABLE IF NOT EXISTS learned_kana (
  kana TEXT PRIMARY KEY,
  learned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
