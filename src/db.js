import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/intertrack.db' : 'intertrack.db');
const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ingin_dilamar'
    CHECK (status IN ('ingin_dilamar','sudah_melamar','tes_seleksi','wawancara','diterima','ditolak')),
  applied_date TEXT,
  job_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('wawancara','tes','tenggat','tindak_lanjut')),
  title TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  notes TEXT,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sch_user ON schedules(user_id, scheduled_at);
`);

export default db;
