# Laparin

Laparin adalah startup fiktif yang membangun aplikasi pemesanan makanan untuk tenant food court. Pelanggan dapat melihat menu tenant, memasukkan pesanan ke keranjang, melakukan checkout, lalu memantau status pesanan. Tenant mengelola menu, stok harian, dan daftar pesanan yang masuk.

Repositori ini berisi fondasi project untuk Tugas Besar DevOps (CI/CD Jenkins) pada scope Minggu 1: struktur aplikasi, koneksi database, migrasi, seeder, health check, containerization, dan test dasar. Fitur bisnis (CRUD tenant/menu/order, keranjang, checkout) akan dikerjakan pada pull request berikutnya.

## Anggota & Peran

| No | Nama | NIM | Peran |
|----|------|-----|-------|
| 1 | Reika Elvaretta Putri Utomo | 102062400120 | Tech Lead / Backend |
| 2 | Ghazi Rayshafiq Elfandi | 102062400068 | DevOps Engineer |
| 3 | Shinta Devi Arsy Zelika | 102062400096 | Container Engineer |
| 4 | Semua Anggota | - | QA & Tech Writer |

## Stack

- Node.js 20 + Express (runtime didukung Azure App Service untuk Tugas Besar 2)
- PostgreSQL 16
- Knex (migrasi + seeder) dengan driver `pg`
- Jest + Supertest
- Docker multi-stage, Docker Compose
- Jenkins (pipeline CI/CD berparameter)

Port aplikasi adalah `3000` di dalam container dan dipublikasikan ke host melalui variabel `APP_PORT` (default `8000`).

## Fitur Wajib Laparin

1. CRUD tenant dan menu, termasuk pengelolaan stok harian per menu.
2. Keranjang belanja dan proses checkout.
3. Perubahan status pesanan:
   - `PENDING -> DIPROSES -> SIAP -> SELESAI`
   - `PENDING -> DIBATALKAN`
4. Daftar pesanan per tenant.

## Aturan Bisnis

- Stok menu bersifat harian dan tidak boleh melebihi jumlah yang tersedia saat checkout.
- Jumlah item pada keranjang harus lebih dari nol.
- Harga dan total pembayaran dihitung ulang di sisi server, tidak mempercayai nilai dari client.
- Satu pesanan hanya dimiliki oleh satu tenant. Jika keranjang berisi menu dari beberapa tenant, checkout dipecah menjadi satu pesanan per tenant.
- Status pesanan hanya boleh berpindah sesuai alur yang telah ditentukan. Pesanan yang sudah `SELESAI` atau `DIBATALKAN` bersifat final.
- Pembatalan hanya diperbolehkan saat pesanan masih berstatus `PENDING`.
- Tenant hanya dapat melihat dan mengubah pesanan miliknya sendiri.

## Tantangan DevOps

- Pipeline Jenkins harus berparameter agar dapat dijalankan untuk environment `staging` dan `production` dengan konfigurasi terpisah.
- Pipeline mencakup tahap install, test, build image multi-stage, push ke Docker Hub, deploy, dan smoke test (`curl -f http://<host>:<port>/health`).
- Smoke test membutuhkan database yang sehat sehingga endpoint `/health` harus mengembalikan HTTP 200 dengan `"database":"connected"`.
- Deploy staging dan production harus dapat berjalan berdampingan dengan memanfaatkan `COMPOSE_PROJECT_NAME`, nama volume, dan port yang berbeda.
- Database tidak boleh diekspos ke host maupun internet; akses hanya melalui network internal.

## Menjalankan Secara Lokal

1. Salin konfigurasi environment:

   ```bash
   cp .env.example .env
   ```

   Sesuaikan `DOCKERHUB_USER`, password database, dan `APP_PORT` bila diperlukan.

2. Jalankan stack lokal. Override `compose.local.yaml` menambahkan `build` karena image Docker Hub belum tersedia pada Minggu 1:

   ```bash
   docker compose -f compose.yaml -f compose.local.yaml up -d --build
   ```

3. Periksa status container:

   ```bash
   docker compose ps
   ```

4. Uji health check:

   ```bash
   curl -i http://localhost:8000/health
   ```

   Respons yang diharapkan:

   ```json
   {"status":"ok","database":"connected","timestamp":"..."}
   ```

5. Mengisi data contoh (seed tidak dijalankan otomatis oleh entrypoint):

   ```bash
   docker compose exec app npm run seed
   ```

6. Menghentikan stack:

   ```bash
   docker compose -f compose.yaml -f compose.local.yaml down
   ```

   Tambahkan `-v` bila ingin menghapus volume database.

## Menjalankan Test

Test tidak membutuhkan database karena `src/db.js` dimock pada `tests/health.test.js`.

```bash
npm install
npm test
```

Untuk memastikan image lolos stage test:

```bash
docker build --target test -t laparin:test .
```

Build akan gagal apabila ada test yang gagal karena stage `test` menjalankan `RUN npm test`.

## Struktur Project

```
.
├── src/
│   ├── app.js
│   ├── server.js
│   ├── db.js
│   └── routes/health.js
├── db/
│   ├── migrations/
│   └── seeds/
├── tests/
│   └── health.test.js
├── knexfile.js
├── package.json
├── Dockerfile
├── docker-entrypoint.sh
├── compose.yaml
├── compose.local.yaml
├── .env.example
├── .gitignore
├── .dockerignore
└── README.md
```
