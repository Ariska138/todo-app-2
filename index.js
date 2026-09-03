import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCookie, setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db/index.js';

const app = new Hono();

// ---------------------------------------------------------------- Auth

app.post('/api/register', async (c) => {
  const { username, password } = await c.req.json();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    return c.json({ success: true, data: rows[0] }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ success: false, message: 'Registrasi gagal' }, 500);
  }
});

app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];

  if (!user) {
    return c.json({ success: false, message: 'Username atau password salah' }, 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return c.json({ success: false, message: 'Username atau password salah' }, 401);
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  setCookie(c, 'token', token, { httpOnly: true, sameSite: 'Lax', maxAge: 3600 });
  return c.json({ success: true, message: 'Login berhasil' });
});

app.post('/api/logout', (c) => {
  // maxAge -1 menyuruh browser menghapus cookie-nya
  setCookie(c, 'token', '', { maxAge: -1 });
  return c.json({ success: true, message: 'Logout berhasil' });
});

app.get('/api/me', (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return c.json({ success: true, data: user });
  } catch (err) {
    return c.json({ success: false, message: 'Token tidak valid' }, 401);
  }
});

// ---------------------------------------------------------------- Todos

app.get('/api/todos', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, note, user_id FROM todos WHERE user_id = $1 ORDER BY id',
      [user.id]
    );
    return c.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

app.post('/api/todos', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const { note } = await c.req.json();

    const { rows } = await pool.query(
      'INSERT INTO todos (note, user_id) VALUES ($1, $2) RETURNING id, note, user_id',
      [note, user.id]
    );
    return c.json({ success: true, data: rows[0] }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ---------------------------------------------------------------- File statis

// Taruh SETELAH semua route /api, supaya request ke API tidak dianggap file statis.
app.use('/*', serveStatic({ root: './public' }));

// Ekspor app agar Vercel mengenalinya sebagai serverless handler
export default app;

// Jalankan server hanya di lingkungan lokal (bukan Vercel)
if (!process.env.VERCEL) {
  const port = 3000;
  console.log(`✅ Server is running on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
