CREATE TABLE IF NOT EXISTS definition_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  tests_yaml TEXT NOT NULL,
  source TEXT NOT NULL,
  instruction TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_def_revisions_project_created
  ON definition_revisions(project_id, created_at DESC);
