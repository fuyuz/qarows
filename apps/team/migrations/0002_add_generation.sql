-- Add generation for tests.yml in-place replacement fencing.
ALTER TABLE projects ADD COLUMN generation TEXT NOT NULL DEFAULT '';

UPDATE projects SET generation = id || '-legacy' WHERE generation = '';
