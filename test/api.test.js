import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
let server, base, token;

before(async () => {
  const { default: app } = await import('../src/app.js');
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const call = (p, method = 'GET', body) =>
  fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

test('endpoint terproteksi menolak tanpa token', async () => {
  assert.equal((await call('/api/applications')).status, 401);
});

test('register lalu login', async () => {
  const r = await call('/api/auth/register', 'POST', { name: 'Uji', email: 'uji@mail.com', password: 'password123' });
  assert.equal(r.status, 201);
  const l = await call('/api/auth/login', 'POST', { email: 'uji@mail.com', password: 'password123' });
  token = (await l.json()).token;
  assert.ok(token);
  assert.equal((await call('/api/auth/login', 'POST', { email: 'uji@mail.com', password: 'salah' })).status, 401);
});

test('CRUD lamaran, filter, dan statistik', async () => {
  const c = await call('/api/applications', 'POST', { company: 'Acme', position: 'Intern', status: 'wawancara', applied_date: '2026-09-01' });
  assert.equal(c.status, 201);
  const { id } = await c.json();
  await call('/api/applications', 'POST', { company: 'Beta', position: 'Dev', status: 'sudah_melamar', applied_date: '2026-09-05' });
  assert.equal((await call('/api/applications', 'POST', { company: '', position: 'x' })).status, 400);

  assert.equal((await (await call('/api/applications?q=acme')).json()).length, 1);
  assert.equal((await (await call('/api/applications?status=sudah_melamar')).json()).length, 1);

  const u = await call(`/api/applications/${id}`, 'PUT', { company: 'Acme', position: 'Intern', status: 'diterima', applied_date: '2026-09-01' });
  assert.equal((await u.json()).status, 'diterima');

  const s = await (await call('/api/stats/summary')).json();
  assert.equal(s.total, 2);
  assert.equal(s.interviewRate, 50);
  assert.equal((await (await call('/api/stats/monthly')).json())[0].month, '2026-09');

  assert.equal((await call(`/api/applications/${id}`, 'DELETE')).status, 204);
  assert.equal((await call(`/api/applications/${id}`)).status, 404);
});

test('jadwal', async () => {
  const c = await call('/api/schedules', 'POST', { type: 'wawancara', title: 'Interview', scheduled_at: '2030-01-01T10:00' });
  assert.equal(c.status, 201);
  assert.equal((await (await call('/api/schedules')).json()).length, 1);
});
