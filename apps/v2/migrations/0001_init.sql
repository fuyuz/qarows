-- Local 版 project metadata and persisted snapshots (D1).
-- Real-time coordination runs in ProjectRoom Durable Objects per project.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  tests_yaml TEXT NOT NULL,
  results_json TEXT NOT NULL,
  session_json TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
