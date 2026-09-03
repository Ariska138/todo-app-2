import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from './index.js';

async function migrate() {
  console.log('Menjalankan migrasi...');
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('✅ Migrasi selesai. Tabel users & todos siap.');
}

migrate()
  .catch((err) => {
    console.error('❌ Migrasi gagal:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
