-- D1 schema for japanese-learning gojuon checklist
-- Run this ONCE in CF Dashboard -> D1 -> gojuon-progress -> Console after deploy.
-- v2: composite PK (kana, type) to track hiragana/katakana independently.
-- WARNING: this drops the existing learned_kana table and all its data.

DROP TABLE IF EXISTS learned_kana;

CREATE TABLE learned_kana (
  kana TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('h', 'k')),
  learned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kana, type)
);
