# Laparin

Aplikasi pemesanan makanan untuk deretan tenant food court. Pelanggan memilih menu dari tenant, memasukkannya ke keranjang, lalu checkout. Tenant memproses order lewat status yang berurutan.

Proyek ini adalah **Tugas Besar 1 Komputasi Awan 2026–2027 (CI/CD Pipeline Jenkins)**, Studi Kasus **K04 – Laparin**.

## Anggota Kelompok

| Nama | NIM | Peran |
|---|---|---|
| Reika Elvaretta Putri Utomo | 102062400120 | Tech Lead / Backend |
| Ghazi Rayshafiq Elfandi | 102062400068 | Container Engineer |
| Shinta Devi Arsy Zelika | 102062400096 | DevOps Engineer |
| Semua anggota | - | QA Engineer & Tech Writer |

## Tech Stack

- Bahasa/Framework: PHP 8.3, Laravel 11
- Database: MySQL 8 (test memakai SQLite in-memory)
- Testing: PHPUnit (Laravel Feature Test)
- Container: Docker (multi-stage, ada stage `test`), Docker Compose
- CI/CD: Jenkins, GitHub Webhook (via Ngrok), Docker Hub

## Fitur

1. **Tenant**: CRUD tenant (nama, deskripsi)
2. **Menu**: CRUD menu per tenant (nama, harga, stok harian)
3. **Keranjang**: tambah item, lihat keranjang, hapus item (diidentifikasi dengan `customer_name`, tanpa login)
4. **Checkout**: membuat order dari isi keranjang
5. **Order**: ubah status, daftar order per tenant (filter status)
6. **Sistem**: `GET /health`, migrasi, dan seeder data contoh

## Aturan Bisnis

1. Status order hanya boleh berpindah berurutan: `PENDING → DIPROSES → SIAP → SELESAI`, atau `PENDING → DIBATALKAN`. Lompatan status ditolak (HTTP 422).
2. Stok menu berkurang saat checkout dan tidak boleh minus. Checkout ditolak jika stok tidak cukup.
3. Total harga dihitung di server dari harga menu di database, bukan dikirim klien.
4. Satu keranjang hanya boleh berisi menu dari satu tenant.

## Endpoint API

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/health` | Status aplikasi dan koneksi database |
| GET, POST | `/api/tenants` | Daftar / tambah tenant |
| GET, PUT, DELETE | `/api/tenants/{id}` | Detail / ubah / hapus tenant |
| GET, POST | `/api/tenants/{id}/menus` | Daftar / tambah menu tenant |
| PUT, DELETE | `/api/menus/{id}` | Ubah / hapus menu |
| GET | `/api/cart?customer_name=` | Lihat keranjang |
| POST | `/api/cart/items` | Tambah item (`customer_name`, `menu_id`, `qty`) |
| DELETE | `/api/cart/items/{id}` | Hapus item keranjang |
| POST | `/api/checkout` | Checkout (`customer_name`) |
| GET | `/api/tenants/{id}/orders?status=` | Daftar order tenant |
| GET | `/api/orders/{id}` | Detail order |
| PATCH | `/api/orders/{id}/status` | Ubah status order |

## Struktur Database

- `tenants` (id, name, description)
- `menus` (id, tenant_id, name, price, stock)
- `cart_items` (id, customer_name, menu_id, qty)
- `orders` (id, tenant_id, customer_name, status, total)
- `order_items` (id, order_id, menu_id, qty, price)

## Daftar Test

| No | Test | Aturan yang diuji |
|---|---|---|
| 1 | `/health` mengembalikan 200 | Sistem |
| 2 | Membuat tenant dan menu berhasil | CRUD |
| 3 | Transisi status valid (PENDING → DIPROSES) berhasil | Aturan 1 |
| 4 | Lompatan status (PENDING → SELESAI) ditolak | Aturan 1 |
| 5 | Checkout mengurangi stok | Aturan 2 |
| 6 | Checkout ditolak jika stok kurang | Aturan 2 |
| 7 | Total dihitung server, harga dari klien diabaikan | Aturan 3 |

## Alur Pipeline

```
Developer → Pull Request → merge ke main
   → GitHub Webhook (Ngrok /github-webhook/)
   → Jenkins: Checkout → Test → Build Image → Push Image (Docker Hub) → Deploy (Docker Compose) → Smoke Test (/health)
```

Image diberi dua tag: nomor build dan `latest`.

## Tantangan DevOps Khusus (K04)

Pipeline berparameter `TARGET` (`staging` / `production`). Staging dan production berjalan berdampingan di mesin yang sama dengan:

| | Staging | Production |
|---|---|---|
| Nama project Compose | `laparin-staging` | `laparin-prod` |
| Port | 8001 | 8000 |
| Database | sendiri | sendiri |

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # isi password database
docker compose up -d
curl http://localhost:8000/health
```

> Bagian ini akan dilengkapi setelah Dockerfile dan compose.yaml selesai.

## Link

- Repository: https://github.com/Shintadevii/tubes-devops-kelompok04-laparin.git
- Docker Hub: `<username>/laparin`

## Alur Kolaborasi

Branch `main` hanya diubah lewat Pull Request. Penamaan branch: `feature/<nama-fitur>`.
