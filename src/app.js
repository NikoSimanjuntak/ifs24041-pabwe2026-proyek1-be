import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-ganti-di-produksi';
export const STATUSES = ['ingin_dilamar', 'sudah_melamar', 'tes_seleksi', 'wawancara', 'diterima', 'ditolak'];
export const TYPES = ['wawancara', 'tes', 'tenggat', 'tindak_lanjut'];

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

const bad = (res, message, code = 400) => res.status(code).json({ message });
const clean = (v) => (typeof v === 'string' ? v.trim() : v);

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    req.user = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', SECRET);
    next();
  } catch {
    bad(res, 'Tidak terautentikasi', 401);
  }
}
const sign = (u) => jwt.sign({ id: Number(u.id), email: u.email }, SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: Number(u.id), name: u.name, email: u.email });

/* ---------- Auth ---------- */
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', (req, res) => {
  const name = clean(req.body.name), email = clean(req.body.email)?.toLowerCase(), password = req.body.password;
  if (!name || !email || !password) return bad(res, 'Nama, email, dan password wajib diisi');
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Format email tidak valid');
  if (password.length < 8) return bad(res, 'Password minimal 8 karakter');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'Email sudah terdaftar', 409);
  const r = db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10));
  const user = { id: r.lastInsertRowid, name, email };
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body.email)?.toLowerCase(), password = req.body.password || '';
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email || '');
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return bad(res, 'Email atau password salah', 401);
  res.json({ token: sign(u), user: publicUser(u) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const u = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(req.user.id);
  if (!u) return bad(res, 'Pengguna tidak ditemukan', 401);
  res.json(publicUser(u));
});

app.put('/api/auth/me', auth, (req, res) => {
  const name = clean(req.body.name);
  if (!name) return bad(res, 'Nama wajib diisi');
  db.prepare('UPDATE users SET name=? WHERE id=?').run(name, req.user.id);
  res.json(publicUser(db.prepare('SELECT id,name,email FROM users WHERE id=?').get(req.user.id)));
});

/* ---------- Lamaran (CRUD) ---------- */
function parseApplication(body) {
  const a = {
    company: clean(body.company), position: clean(body.position),
    status: body.status || 'ingin_dilamar', applied_date: clean(body.applied_date) || null,
    job_url: clean(body.job_url) || null, notes: clean(body.notes) || null,
  };
  if (!a.company || !a.position) return { error: 'Nama perusahaan dan posisi wajib diisi' };
  if (!STATUSES.includes(a.status)) return { error: 'Status tidak valid' };
  if (a.applied_date && !/^\d{4}-\d{2}-\d{2}$/.test(a.applied_date)) return { error: 'Tanggal harus berformat YYYY-MM-DD' };
  if (a.job_url && !/^https?:\/\//i.test(a.job_url)) return { error: 'Tautan lowongan harus diawali http:// atau https://' };
  return { a };
}

app.get('/api/applications', auth, (req, res) => {
  const { q, status, from, to } = req.query;
  const where = ['user_id=?'], p = [req.user.id];
  if (q) { where.push('(company LIKE ? OR position LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  if (status) { where.push('status=?'); p.push(status); }
  if (from) { where.push('applied_date>=?'); p.push(from); }
  if (to) { where.push('applied_date<=?'); p.push(to); }
  res.json(db.prepare(`SELECT * FROM applications WHERE ${where.join(' AND ')} ORDER BY COALESCE(applied_date,'9999') DESC, id DESC`).all(...p));
});

app.get('/api/applications/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM applications WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  row ? res.json(row) : bad(res, 'Lamaran tidak ditemukan', 404);
});

app.post('/api/applications', auth, (req, res) => {
  const { a, error } = parseApplication(req.body);
  if (error) return bad(res, error);
  const r = db.prepare('INSERT INTO applications(user_id,company,position,status,applied_date,job_url,notes) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, a.company, a.position, a.status, a.applied_date, a.job_url, a.notes);
  res.status(201).json(db.prepare('SELECT * FROM applications WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/applications/:id', auth, (req, res) => {
  const { a, error } = parseApplication(req.body);
  if (error) return bad(res, error);
  const r = db.prepare('UPDATE applications SET company=?,position=?,status=?,applied_date=?,job_url=?,notes=? WHERE id=? AND user_id=?')
    .run(a.company, a.position, a.status, a.applied_date, a.job_url, a.notes, req.params.id, req.user.id);
  if (!r.changes) return bad(res, 'Lamaran tidak ditemukan', 404);
  res.json(db.prepare('SELECT * FROM applications WHERE id=?').get(req.params.id));
});

app.delete('/api/applications/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM applications WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  r.changes ? res.status(204).end() : bad(res, 'Lamaran tidak ditemukan', 404);
});

/* ---------- Jadwal & pengingat ---------- */
function parseSchedule(body, userId) {
  const s = {
    application_id: body.application_id ? Number(body.application_id) : null,
    type: body.type, title: clean(body.title), scheduled_at: clean(body.scheduled_at),
    notes: clean(body.notes) || null, done: body.done ? 1 : 0,
  };
  if (!s.title || !s.scheduled_at) return { error: 'Judul dan waktu wajib diisi' };
  if (!TYPES.includes(s.type)) return { error: 'Jenis jadwal tidak valid' };
  if (Number.isNaN(Date.parse(s.scheduled_at))) return { error: 'Format waktu tidak valid' };
  if (s.application_id && !db.prepare('SELECT 1 FROM applications WHERE id=? AND user_id=?').get(s.application_id, userId))
    return { error: 'Lamaran terkait tidak ditemukan', code: 404 };
  return { s };
}
const SCH_SQL = `SELECT s.*, a.company, a.position FROM schedules s LEFT JOIN applications a ON a.id=s.application_id`;

app.get('/api/schedules', auth, (req, res) => {
  const upcoming = req.query.upcoming === '1';
  const sql = `${SCH_SQL} WHERE s.user_id=? ${upcoming ? "AND s.done=0 AND s.scheduled_at>=datetime('now','-1 day')" : ''} ORDER BY s.scheduled_at ASC`;
  res.json(db.prepare(sql).all(req.user.id));
});

app.post('/api/schedules', auth, (req, res) => {
  const { s, error, code } = parseSchedule(req.body, req.user.id);
  if (error) return bad(res, error, code);
  const r = db.prepare('INSERT INTO schedules(user_id,application_id,type,title,scheduled_at,notes,done) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, s.application_id, s.type, s.title, s.scheduled_at, s.notes, s.done);
  res.status(201).json(db.prepare(`${SCH_SQL} WHERE s.id=?`).get(r.lastInsertRowid));
});

app.put('/api/schedules/:id', auth, (req, res) => {
  const { s, error, code } = parseSchedule(req.body, req.user.id);
  if (error) return bad(res, error, code);
  const r = db.prepare('UPDATE schedules SET application_id=?,type=?,title=?,scheduled_at=?,notes=?,done=? WHERE id=? AND user_id=?')
    .run(s.application_id, s.type, s.title, s.scheduled_at, s.notes, s.done, req.params.id, req.user.id);
  if (!r.changes) return bad(res, 'Jadwal tidak ditemukan', 404);
  res.json(db.prepare(`${SCH_SQL} WHERE s.id=?`).get(req.params.id));
});

app.delete('/api/schedules/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM schedules WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  r.changes ? res.status(204).end() : bad(res, 'Jadwal tidak ditemukan', 404);
});

/* ---------- Statistik ---------- */
app.get('/api/stats/summary', auth, (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM applications WHERE user_id=? GROUP BY status').all(req.user.id);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  rows.forEach((r) => (byStatus[r.status] = Number(r.n)));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const applied = total - byStatus.ingin_dilamar;
  const reached = byStatus.wawancara + byStatus.diterima;
  res.json({ total, byStatus, applied, interviewRate: applied ? Math.round((reached / applied) * 100) : 0 });
});

app.get('/api/stats/monthly', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', applied_date) AS month, COUNT(*) AS total,
           SUM(CASE WHEN status IN ('wawancara','diterima') THEN 1 ELSE 0 END) AS interview
    FROM applications
    WHERE user_id=? AND applied_date IS NOT NULL AND status!='ingin_dilamar'
    GROUP BY month ORDER BY month`).all(req.user.id);
  res.json(rows.map((r) => ({ month: r.month, total: Number(r.total), interview: Number(r.interview) })));
});

app.get('/', (_req, res) => res.json({ name: 'InternTrack API', status: 'ok', health: '/api/health' }));
app.use((_req, res) => bad(res, 'Endpoint tidak ditemukan', 404));
app.use((err, _req, res, _next) => { console.error(err); bad(res, 'Kesalahan server', 500); });

export default app;
