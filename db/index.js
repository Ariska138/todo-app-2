import { Pool } from 'pg';

// Konfigurasi SSL dibawa oleh ?sslmode=no-verify di DATABASE_URL,
// supaya cukup diset di satu tempat (file .env).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
