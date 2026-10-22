ALTER TABLE subscriptions ADD COLUMN label TEXT NOT NULL DEFAULT 'Mobile device';
ALTER TABLE subscriptions ADD COLUMN session_token TEXT;
ALTER TABLE subscriptions ADD COLUMN last_seen TEXT;
ALTER TABLE deliveries ADD COLUMN next_attempt TEXT;
ALTER TABLE notifications ADD COLUMN read_at TEXT;
CREATE INDEX IF NOT EXISTS deliveries_ready ON deliveries(status,next_attempt);
CREATE TABLE IF NOT EXISTS user_preferences(member TEXT PRIMARY KEY, value TEXT NOT NULL);
