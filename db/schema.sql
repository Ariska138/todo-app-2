-- Skema database untuk aplikasi Todos.
-- File ini dijalankan oleh `npm run db:migrate`.

CREATE TABLE IF NOT EXISTS users (
  id       SERIAL       PRIMARY KEY,
  username VARCHAR(256) NOT NULL UNIQUE,
  password VARCHAR(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id      SERIAL  PRIMARY KEY,
  note    TEXT    NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id)
);
