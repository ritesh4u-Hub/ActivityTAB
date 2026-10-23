ALTER TABLE tasks ADD COLUMN escalation_manager TEXT;
ALTER TABLE tasks ADD COLUMN escalation_hours INTEGER;
ALTER TABLE tasks ADD COLUMN escalated_at TEXT;
CREATE INDEX IF NOT EXISTS tasks_escalation_manager ON tasks(escalation_manager,escalated_at);
