CREATE TABLE IF NOT EXISTS ai_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  proposed_yaml TEXT NOT NULL,
  base_generation TEXT NOT NULL,
  instruction TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_project_created
  ON ai_proposals(project_id, created_at DESC);
