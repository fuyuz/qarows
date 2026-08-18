-- Team 版: 端末/環境選択と実施者名はクライアント / Access 認証側。
-- D1 にはセッション開始済みかどうかのフラグのみ残す。
ALTER TABLE projects ADD COLUMN session_started INTEGER NOT NULL DEFAULT 0;

UPDATE projects
SET session_started = 1
WHERE session_json IS NOT NULL
  AND trim(session_json) != ''
  AND session_json != 'null';

ALTER TABLE projects DROP COLUMN session_json;
