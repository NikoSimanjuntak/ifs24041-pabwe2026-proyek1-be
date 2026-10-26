# InternTrack - Backend

REST API Express.js + SQLite (`node:sqlite` bawaan Node >= 22.5, tanpa kompilasi native) dengan autentikasi JWT.

## Menjalankan
```bash
git clone <URL-REPO-BACKEND> && cd <folder>
npm install
npm run seed     # opsional: akun demo demo@intertrack.id / demo12345
npm start        # http://localhost:3000
```
Variabel lingkungan: lihat `.env.example` (`PORT`, `JWT_SECRET`, `DB_PATH`, `CORS_ORIGIN`).

## Pengujian
`npm test` (node:test; hasil JUnit di `test-results.xml`). Pipeline Jenkins ada di `Jenkinsfile`.

## Deploy
`docker build -t intertrack-api . && docker run -p 3000:3000 -v intertrack-data:/data -e JWT_SECRET=rahasia intertrack-api`

## API (prefix `/api`; selain auth & health wajib `Authorization: Bearer <token>`)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | /health | Cek status |
| POST | /auth/register, /auth/login | Daftar / masuk |
| GET, PUT | /auth/me | Profil |
| GET, POST | /applications | Daftar (filter `q,status,from,to`) / tambah |
| GET, PUT, DELETE | /applications/:id | Detail / ubah / hapus |
| GET, POST | /schedules | Daftar (`?upcoming=1`) / tambah |
| PUT, DELETE | /schedules/:id | Ubah / hapus |
| GET | /stats/summary | Total, per status, rasio wawancara |
| GET | /stats/monthly | Lamaran per bulan & lanjut wawancara |
