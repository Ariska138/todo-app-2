// db/check-connection.js
// Skrip untuk mengecek apakah aplikasi bisa tersambung ke database,
// dan kalau gagal, menjelaskan apa penyebabnya.
//
// Cara pakai:
//   npm run db:check

import 'dotenv/config';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

// Sembunyikan password supaya tidak pernah tercetak di terminal
const redacted = url ? url.replace(/\/\/([^:/@]+):([^@]*)@/, '//$1:****@') : null;

if (!url) {
  console.log('❌ DATABASE_URL belum terbaca.');
  console.log('   Buat file .env di root proyek, lalu isi:');
  console.log('   DATABASE_URL="postgresql://postgres:PASSWORD@db.[project-ref].supabase.co:5432/postgres?sslmode=no-verify"');
  console.log('   Pastikan file .env tidak ikut ter-commit (sudah ada di .gitignore).');
  process.exit(1);
}

console.log('Mengecek koneksi ke:');
console.log(`  ${redacted}\n`);

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10000 });

function explain(err) {
  const m = err.message || String(err);
  const code = err.code || '';

  if (/Invalid URL/i.test(m)) {
    return [
      'Password mengandung karakter spesial',
      "Karakter '?' di dalam password membuat URL tidak valid.\n" +
        '     Ganti password menjadi huruf dan angka saja, atau percent-encode:\n' +
        '       ? -> %3F    * -> %2A    @ -> %40    # -> %23',
    ];
  }
  if (code === '28P01') {
    return [
      'Password ditolak oleh server',
      'Servernya ketemu, jadi project ref sudah benar — tinggal password yang salah.\n' +
        '     Reset lewat Supabase: Project Settings > Database > Reset database password.',
    ];
  }
  if (/Tenant or user not found/i.test(m)) {
    return [
      'Project ref salah',
      'Salin ulang connection string dari tombol Connect di dashboard Supabase.',
    ];
  }
  if (/self-signed certificate/i.test(m)) {
    return [
      'Masalah sertifikat SSL',
      "Hapus '?sslmode=require' dari DATABASE_URL.\n" +
        "     Di pg versi terbaru, 'require' diperlakukan seperti verify-full.\n" +
        "     Pakai '?sslmode=no-verify' sebagai gantinya.",
    ];
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return [
      'Host tidak ditemukan',
      'Direct connection hanya jalan di IPv6. Kalau jaringan Anda IPv4 saja,\n' +
        '     pakai Session pooler: aws-0-[region].pooler.supabase.com port 5432.',
    ];
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
    return [
      'Koneksi ditolak atau timeout',
      'Cek port yang dipakai (5432 untuk direct/session, 6543 untuk transaction pooler)\n' +
        '     dan pastikan koneksi internet Anda tidak memblokirnya.',
    ];
  }
  if (/does not support SSL|no encryption/i.test(m)) {
    return [
      'Server menolak koneksi tanpa SSL',
      "Tambahkan '?sslmode=no-verify' di akhir DATABASE_URL.",
    ];
  }
  return [err.name || 'Error', m];
}

try {
  const info = await pool.query(`
    select current_user       as user,
           current_database() as database,
           version()          as version
  `);
  const ssl = await pool.query(`select ssl from pg_stat_ssl where pid = pg_backend_pid()`);
  const tables = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name in ('users', 'todos')
    order by table_name
  `);

  const v = info.rows[0];
  console.log('✅ Berhasil tersambung.');
  console.log(`   user     : ${v.user}`);
  console.log(`   database : ${v.database}`);
  console.log(`   versi    : ${v.version.split(',')[0]}`);
  console.log(`   ssl      : ${ssl.rows[0]?.ssl ? 'aktif' : 'TIDAK aktif'}`);

  const found = tables.rows.map((r) => r.table_name);
  const missing = ['users', 'todos'].filter((t) => !found.includes(t));
  if (missing.length === 0) {
    console.log('   tabel    : users, todos ✅');
  } else {
    console.log(`   tabel    : ${missing.join(', ')} belum ada`);
    console.log('\n⚠️  Jalankan dulu: npm run db:migrate');
  }

  if (url.includes(':6543')) {
    console.log('\n⚠️  Anda memakai port 6543 (transaction pooler).');
    console.log('   Port ini tidak mendukung migrasi: npm run db:migrate akan');
    console.log('   menggantung lalu gagal tanpa pesan error. Ganti ke port 5432.');
  }
} catch (err) {
  const [judul, penjelasan] = explain(err);
  console.log(`❌ ${judul}`);
  console.log(`   ${penjelasan}`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
