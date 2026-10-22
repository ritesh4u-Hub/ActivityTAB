CREATE TABLE conversations(id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, task TEXT UNIQUE, direct_key TEXT UNIQUE, owner TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE chat_members(conversation TEXT NOT NULL, member TEXT NOT NULL, last_read_seq INTEGER NOT NULL DEFAULT 0, muted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(conversation,member));
CREATE INDEX chat_members_member ON chat_members(member,conversation);
CREATE TABLE chat_messages(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, conversation TEXT NOT NULL, sender TEXT NOT NULL, client_id TEXT NOT NULL, body TEXT NOT NULL, file_id TEXT, file_name TEXT, file_type TEXT, file_size INTEGER, created TEXT NOT NULL, UNIQUE(conversation,sender,client_id));
CREATE INDEX chat_messages_conversation ON chat_messages(conversation,seq);
ALTER TABLE notifications ADD COLUMN conversation TEXT;
CREATE INDEX notice_conversation ON notifications(recipient,conversation,read);
