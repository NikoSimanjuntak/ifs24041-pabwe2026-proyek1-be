import bcrypt from 'bcryptjs';
import db from './db.js';

const email = 'demo@intertrack.id';
db.prepare('DELETE FROM users WHERE email=?').run(email);
const uid = Number(db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)')
  .run('Mahasiswa Demo', email, bcrypt.hashSync('demo12345', 10)).lastInsertRowid);

const apps = [
  ['Tokopedia', 'Frontend Developer Intern', 'sudah_melamar', '2026-08-05', 'https://careers.example.com/1'],
  ['Gojek', 'Backend Engineer Intern', 'tes_seleksi', '2026-08-18', 'https://careers.example.com/2'],
  ['Traveloka', 'Data Analyst Intern', 'wawancara', '2026-09-02', 'https://careers.example.com/3'],
  ['Telkom Indonesia', 'IT Support Intern', 'diterima', '2026-09-10', 'https://careers.example.com/4'],
  ['Bukalapak', 'QA Engineer Intern', 'ditolak', '2026-09-15', null],
  ['Shopee', 'Mobile Developer Intern', 'ingin_dilamar', null, 'https://careers.example.com/6'],
  ['Blibli', 'UI/UX Intern', 'wawancara', '2026-10-01', null],
];
const ins = db.prepare('INSERT INTO applications(user_id,company,position,status,applied_date,job_url) VALUES (?,?,?,?,?,?)');
const ids = apps.map((a) => Number(ins.run(uid, ...a).lastInsertRowid));

const day = (n, h = 10) => { const d = new Date(Date.now() + n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString().slice(0, 16); };
const sch = db.prepare('INSERT INTO schedules(user_id,application_id,type,title,scheduled_at) VALUES (?,?,?,?,?)');
sch.run(uid, ids[2], 'wawancara', 'Wawancara HR Traveloka', day(2));
sch.run(uid, ids[1], 'tes', 'Tes coding Gojek', day(4, 14));
sch.run(uid, ids[5], 'tenggat', 'Batas pendaftaran Shopee', day(6, 23));
sch.run(uid, ids[0], 'tindak_lanjut', 'Follow up email Tokopedia', day(1, 9));
console.log('Seed selesai. Login: demo@intertrack.id / demo12345');
