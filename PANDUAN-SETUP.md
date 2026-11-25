# Panduan Setup Laparin di Laptop Baru

Panduan ini untuk menjalankan project ini dari nol, termasuk kalau baru pertama kali pakai Node.js, npm, atau Knex.

---

## 1. Apa itu Node.js, npm, dan Knex?

- **Node.js** = runtime untuk menjalankan JavaScript di luar browser. Project ini butuh **Node.js 20 atau lebih baru**.
- **npm** = package manager Node.js. Dipakai untuk install library (`npm install`) dan menjalankan script (`npm start`, `npm run migrate`, dll). Otomatis terpasang bersama Node.js.
- **Knex** = *query builder* + alat **migration** untuk database SQL (bukan ORM penuh seperti Sequelize). Di project ini Knex dipakai untuk:
  - `npm run migrate` → membuat/mengubah struktur tabel dari file di `db/migrations`
  - `npm run seed` → mengisi data contoh dari file di `db/seeds`
- **PostgreSQL** (`pg`) = database yang dipakai project ini. **Project ini TIDAK memakai MySQL.**

---

## 2. Pilih Cara Menjalankan

Ada dua cara. Pilih salah satu:

- **Cara A — Docker (paling gampang, direkomendasikan).** DB dan Node otomatis disiapkan di dalam container. Tidak perlu install Node.js atau PostgreSQL manual.
- **Cara B — Manual (Node.js + PostgreSQL).** Cocok kalau tidak bisa/tidak mau pakai Docker.

---

## Cara A — Pakai Docker (Direkomendasikan)

### Yang dibutuhkan
- Docker Desktop (Windows/Mac) atau Docker Engine + Compose (Linux)
- Di Windows: aktifkan WSL2 saat install Docker Desktop

Cek Docker sudah jalan:
```bash
docker --version
docker compose version
```

### Langkah

1. **Extract zip** project, lalu buka terminal di folder project (folder yang berisi `compose.yaml` dan `package.json`).

2. **Buat file `.env`** dari contoh. Kalau file `.env` belum ada:
   - Windows (PowerShell): `Copy-Item .env.example .env`
   - Linux/Mac: `cp .env.example .env`

3. **Edit `.env`**, minimal isi password database. Contoh:
   ```env
   COMPOSE_PROJECT_NAME=laparin
   DOCKERHUB_USER=localdev
   IMAGE_TAG=latest
   APP_PORT=8000
   NODE_ENV=production
   DB_HOST=db
   DB_PORT=5432
   POSTGRES_USER=laparin
   POSTGRES_PASSWORD=laparin_local_password
   POSTGRES_DB=laparin
   ```

4. **Jalankan stack** (build image lokal + start app & database):
   ```bash
   docker compose -f compose.yaml -f compose.local.yaml up -d --build
   ```
   Tunggu sampai selesai. Pertama kali bisa beberapa menit karena download image.

5. **Cek status container:**
   ```bash
   docker compose ps
   ```
   `app` dan `db` harus berstatus `healthy` / `running`.

6. **Tes health check.** Buka di browser atau jalankan:
   ```bash
   curl http://localhost:8000/health
   ```
   Respons yang diharapkan:
   ```json
   {"status":"ok","database":"connected","timestamp":"..."}
   ```

7. **Isi data contoh** (seed tidak otomatis dijalankan):
   ```bash
   docker compose exec app npm run seed
   ```

8. **Menghentikan stack:**
   ```bash
   docker compose -f compose.yaml -f compose.local.yaml down
   ```
   Tambahkan `-v` kalau ingin menghapus data database juga:
   ```bash
   docker compose -f compose.yaml -f compose.local.yaml down -v
   ```

Catatan: aplikasi berjalan di port `3000` di dalam container, dan dipublikasikan ke host lewat `APP_PORT` (default `8000`). Jadi aksesnya `http://localhost:8000`.

---

## Cara B — Manual (Node.js + PostgreSQL)

### Yang dibutuhkan
- **Node.js 20 LTS** atau lebih baru → https://nodejs.org
- **PostgreSQL 16** → https://www.postgresql.org/download

Cek instalasi:
```bash
node -v
npm -v
```
Pastikan `node -v` menampilkan `v20.x` atau lebih tinggi.

### Langkah

1. **Install PostgreSQL 16**, lalu buat user dan database:
   - User: `laparin`
   - Password: bebas (catat!)
   - Database: `laparin`

   Bisa lewat pgAdmin, atau lewat `psql`:
   ```sql
   CREATE USER laparin WITH PASSWORD 'password_kamu';
   CREATE DATABASE laparin OWNER laparin;
   ```

2. **Extract zip**, buka terminal di folder project.

3. **Hapus folder `node_modules` hasil zip** (kalau ada), karena binary-nya bisa beda OS. Lalu install ulang:
   ```bash
   npm install
   ```

4. **Edit `.env`** supaya menunjuk ke PostgreSQL lokal. Ini langkah yang paling sering salah:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   POSTGRES_USER=laparin
   POSTGRES_PASSWORD=password_kamu
   POSTGRES_DB=laparin
   PORT=3000
   NODE_ENV=development
   ```
   > `DB_HOST=db` hanya berlaku di dalam Docker. Untuk manual **wajib** `localhost`.

5. **Buat tabel lewat migration:**
   ```bash
   npm run migrate
   ```

6. **Isi data contoh:**
   ```bash
   npm run seed
   ```

7. **Jalankan aplikasi:**
   ```bash
   npm start
   ```

8. **Tes di browser:** buka `http://localhost:3000/health`, harus muncul:
   ```json
   {"status":"ok","database":"connected","timestamp":"..."}
   ```

---

## 3. Menjalankan Test

Test tidak membutuhkan database (koneksi DB di-mock), jadi bisa langsung:
```bash
npm install
npm test
```

---

## 4. Masalah yang Sering Muncul

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL belum jalan atau port salah | Pastikan service PostgreSQL jalan, cek `DB_PORT` |
| `password authentication failed` | Password di `.env` salah | Samakan `POSTGRES_PASSWORD` dengan password DB |
| Error `database "laparin" does not exist` | Database belum dibuat | Buat database `laparin` (lihat Cara B langkah 1) |
| `getaddrinfo ENOTFOUND db` saat manual | `DB_HOST=db` (settingan Docker) dipakai di luar Docker | Ganti `DB_HOST=localhost` |
| Tabrakan sintaks / modul aneh setelah unzip | `node_modules` dari OS lain ikut ter-zip | Hapus `node_modules`, jalankan `npm install` |
| `npm ERR! engine node >=20` | Node.js terlalu lama | Install Node.js 20 LTS atau lebih baru |
| Port `8000`/`3000` sudah dipakai | Ada aplikasi lain | Ganti `APP_PORT` di `.env` (Docker) atau `PORT` (manual) |
| Pakai MySQL | Project ini butuh PostgreSQL | Install PostgreSQL, driver-nya `pg` |

---

## 5. Ringkasan Perintah

Docker:
```bash
Copy-Item .env.example .env      # lalu edit password
docker compose -f compose.yaml -f compose.local.yaml up -d --build
docker compose ps
docker compose exec app npm run seed
curl http://localhost:8000/health
```

Manual:
```bash
npm install
npm run migrate
npm run seed
npm start
curl http://localhost:3000/health
```
