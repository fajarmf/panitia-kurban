# 🐄 Panitia Kurban — Masjid Al Hijrah CGE

Aplikasi full-stack untuk manajemen panitia kurban. Generate voucher QR, scan via kamera HP, dan kelola distribusi daging kurban.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 16 (Docker) |
| ORM | TypeORM (auto-sync) |
| Auth | JWT + Passport |
| Frontend | HTML + Tailwind CSS v3 + Vanilla JS |
| QR/PDF | `qrcode` + `pdfkit` + `html5-qrcode` |

## Prerequisites

- **Node.js** 18+
- **Docker** (untuk PostgreSQL)

## Cara Menjalankan

```bash
# 1. Install dependencies
npm install

# 2. Start database PostgreSQL
docker-compose up -d

# 3. Jalankan development server (watch mode)
npm run start:dev

# 4. Buka di browser
open http://localhost:3000
```

> Saat pertama kali jalan, otomatis membuat akun Super Admin.

### Default Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Super Admin |

## Build & Production

```bash
# Compile TypeScript → JavaScript
npm run build

# Jalankan production build
npm run start:prod
```

## Scripts Lainnya

```bash
npm run start          # Start tanpa watch
npm run start:debug    # Debug mode + watch
npm run lint           # ESLint fix
npm run format         # Prettier format
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
npm run test:cov       # Test coverage
```

## Environment Variables

Buat file `.env` di root project:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin123
DB_NAME=panitia_kurban
JWT_SECRET=panitia-kurban-secret-key-2026
JWT_EXPIRES_IN=7d
PORT=3000
UPLOAD_DIR=./uploads
```

## Struktur Direktori

```
panitia-kurban/
├── client/                  # Frontend (served via @nestjs/serve-static)
│   ├── css/style.css        # Glassmorphism theme
│   ├── js/app.js            # Shared utilities (API, auth, nav)
│   ├── index.html           # Login page
│   ├── dashboard.html       # Dashboard + statistik
│   ├── users.html           # Manajemen user (Super Admin)
│   ├── events.html          # Manajemen event + upload logo
│   ├── pengkurban.html      # Data pengkurban
│   ├── vouchers.html        # Voucher CRUD + PDF download
│   └── scanner.html         # QR Scanner (kamera HP)
├── src/                     # Backend NestJS
│   ├── auth/                # JWT + Role guard
│   ├── users/               # CRUD users
│   ├── events/              # CRUD events + logo upload
│   ├── pengkurban/          # CRUD pengkurban
│   ├── vouchers/            # Voucher + QR + PDF + scan
│   ├── dashboard/           # Statistik
│   └── seed/                # Auto-seed Super Admin
├── uploads/                 # File uploads (logo, dll)
├── docker-compose.yml       # PostgreSQL container
└── .env                     # Konfigurasi environment
```

## Role & Permission

| Role | Voucher | Scan | User | Pengkurban | Event | Dashboard |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ketua Panitia | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Panitia Voucher | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Panitia Scanner | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |

## Fitur Utama

- **Manajemen Event** — Buat event kurban, upload logo masjid
- **Data Pengkurban** — Input nama, jenis hewan (sapi/kambing/domba), tipe akad
- **Generate Voucher QR** — PDF dengan logo, QR code, nomor unik, tanggal
- **Batch Voucher** — Buat hingga 500 voucher sekaligus (kode sequential: `QRB-2026-0001`)
- **Scan QR** — Klaim voucher via kamera HP, dengan fallback input manual
- **Dashboard** — Statistik distribusi real-time
- **Audit Log** — Riwayat scan tercatat otomatis

## Dokumentasi Lengkap

Lihat [docs/implementation_plan.md](docs/implementation_plan.md) untuk detail arsitektur, database schema, API endpoints, dan langkah implementasi.
