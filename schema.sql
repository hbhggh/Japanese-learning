-- D1 schema for japanese-learning gojuon checklist
-- Run this ONCE in CF Dashboard -> D1 -> gojuon-progress -> Console after deploy.
-- v3: revert to single-PK (kana). UI shows "hiragana/katakana" as one combined
-- text label with a single shared toggle. Drops any prior table state.

DROP TABLE IF EXISTS learned_kana;

CREATE TABLE learned_kana (
  kana TEXT PRIMARY KEY,
  learned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
