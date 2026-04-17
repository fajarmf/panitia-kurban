# Aplikasi Panitia Kurban — Masjid Al Hijrah CGE

## Daftar Isi

- [Ringkasan Proyek](#ringkasan-proyek)
- [Tech Stack](#tech-stack)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Database Schema](#database-schema)
- [Role & Permission](#role--permission)
- [Struktur Direktori](#struktur-direktori)
- [API Endpoints](#api-endpoints)
- [Fitur Utama](#fitur-utama)
- [Langkah Implementasi](#langkah-implementasi)
- [Cara Menjalankan](#cara-menjalankan)
- [Daftar Tugas](#daftar-tugas)

---

## Ringkasan Proyek

Aplikasi full-stack untuk manajemen panitia kurban Masjid Al Hijrah CGE. Fitur utama meliputi:

- **Manajemen User** berbasis role (Super Admin, Ketua Panitia, Panitia Voucher, Panitia Scanner)
- **Generate Voucher QR** dalam bentuk PDF (dengan logo masjid custom, nama masjid, judul kupon + tahun, nomor unik, tanggal)
- **Scan Voucher QR** via kamera HP untuk klaim pengambilan daging kurban
- **Data Pengkurban** (nama, jenis hewan, tipe akad)
- **Dashboard** statistik distribusi real-time

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 16 (via Docker) |
| ORM | TypeORM (auto-sync entities) |
| Auth | JWT + Passport (`passport-jwt`) |
| QR Code | `qrcode` library |
| PDF | `pdfkit` library |
| Frontend | HTML + Tailwind CSS v3 (CDN) + Vanilla JS |
| QR Scanner | `html5-qrcode` library (kamera HP) |
| File Upload | Multer (`@nestjs/platform-express`) |
| Static Serve | `@nestjs/serve-static` |

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Login   │ │Dashboard │ │ Voucher  │ │ Scanner  │   │
│  │  Page    │ │  Page    │ │  Page    │ │  Page    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │            │             │         │
│       └─────────────┴────────────┴─────────────┘         │
│                         │ HTTP/REST                      │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────┐
│                    NestJS Server (:3000)                  │
│                         │                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │              ServeStaticModule                    │    │
│  │         (serves client/ directory)                │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │ Auth │ │Users │ │Events│ │Peng- │ │Vouch-│ │Dash- ││
│  │Module│ │Module│ │Module│ │kurban│ │ ers  │ │board ││
│  │      │ │      │ │      │ │Module│ │Module│ │Module││
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘│
│     │        │        │        │        │        │     │
│  ┌──┴────────┴────────┴────────┴────────┴────────┴──┐  │
│  │              TypeORM (Auto-sync)                   │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │   PostgreSQL 16    │
                │   (Docker)         │
                └───────────────────┘
```

---

## Database Schema

### Tabel `users`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | Primary key |
| username | VARCHAR (unique) | Username login |
| password | VARCHAR | bcrypt hash |
| full_name | VARCHAR | Nama lengkap |
| role | ENUM | SUPER_ADMIN, KETUA_PANITIA, PANITIA_VOUCHER, PANITIA_SCANNER |
| is_active | BOOLEAN | Status aktif/nonaktif |
| created_at | TIMESTAMP | Tanggal dibuat |
| updated_at | TIMESTAMP | Tanggal diupdate |

### Tabel `events`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | Primary key |
| name | VARCHAR | Nama event (e.g. "Idul Adha 1447H") |
| year | VARCHAR | Tahun (e.g. "2026" atau "1447H") |
| event_date | DATE | Tanggal event |
| description | VARCHAR | Deskripsi (opsional) |
| logo_path | VARCHAR | Path file logo yang diupload |
| is_active | BOOLEAN | Status aktif |
| created_at | TIMESTAMP | Tanggal dibuat |

### Tabel `pengkurban`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | Primary key |
| event_id | UUID (FK → events) | Relasi ke event |
| name | VARCHAR | Nama pengkurban |
| animal_type | ENUM | SAPI, KAMBING, DOMBA |
| purchase_type | ENUM | BELI_MASJID, BAWA_SENDIRI |
| phone | VARCHAR | No. telepon (opsional) |
| notes | VARCHAR | Catatan (opsional) |
| created_at | TIMESTAMP | Tanggal dibuat |

### Tabel `vouchers`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | Primary key |
| event_id | UUID (FK → events) | Relasi ke event |
| voucher_code | VARCHAR (unique) | Kode unik (e.g. QRB-2026-0001) |
| qr_data | TEXT | QR code data URL (base64) |
| status | ENUM | ACTIVE, CLAIMED, CANCELLED |
| distribution_date | DATE | Tanggal distribusi daging |
| claimed_by | UUID (FK → users) | User yang mengklaim |
| claimed_at | TIMESTAMP | Waktu diklaim |
| created_by | UUID (FK → users) | User yang membuat |
| created_at | TIMESTAMP | Tanggal dibuat |

### Tabel `scan_logs`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | Primary key |
| voucher_id | UUID (FK → vouchers) | Relasi ke voucher |
| scanned_by | UUID (FK → users) | User yang scan |
| action | VARCHAR | CLAIMED, REJECTED, INFO |
| notes | VARCHAR | Catatan hasil scan |
| scanned_at | TIMESTAMP | Waktu scan |

### Relasi Antar Tabel

```
events ─┬──< pengkurban
        └──< vouchers ──< scan_logs
users ──┬──< vouchers (created_by)
        ├──< vouchers (claimed_by)
        └──< scan_logs (scanned_by)
```

---

## Role & Permission

| Role | Buat Voucher | Scan Voucher | Kelola User | Kelola Pengkurban | Kelola Event | Dashboard |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ketua Panitia** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Panitia Voucher** | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ (limited) |
| **Panitia Scanner** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ (limited) |

---

## Struktur Direktori

```
panitia-kurban/
├── client/                          # Frontend (served via @nestjs/serve-static)
│   ├── css/
│   │   └── style.css                # Custom CSS (glassmorphism, animations)
│   ├── js/
│   │   └── app.js                   # Shared utilities (API, auth, nav, toast)
│   ├── index.html                   # Login page
│   ├── dashboard.html               # Dashboard + stats
│   ├── users.html                   # User management (Super Admin)
│   ├── events.html                  # Event management + logo upload
│   ├── pengkurban.html              # Data pengkurban
│   ├── vouchers.html                # Voucher CRUD + PDF download
│   └── scanner.html                 # QR Scanner (kamera)
│
├── src/                             # Backend (NestJS)
│   ├── common/enums/                # Shared enums
│   │   ├── role.enum.ts
│   │   ├── animal-type.enum.ts
│   │   ├── purchase-type.enum.ts
│   │   └── voucher-status.enum.ts
│   │
│   ├── auth/                        # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts       # POST /api/auth/login, GET /api/auth/profile
│   │   ├── auth.service.ts          # Login validation, JWT generation
│   │   ├── jwt.strategy.ts          # Passport JWT strategy
│   │   ├── guards/roles.guard.ts    # Role-based access guard
│   │   └── decorators/roles.decorator.ts
│   │
│   ├── users/                       # User management module
│   │   ├── user.entity.ts
│   │   ├── users.module.ts
│   │   ├── users.controller.ts      # CRUD /api/users (Super Admin only)
│   │   ├── users.service.ts
│   │   └── dto/user.dto.ts
│   │
│   ├── events/                      # Event management module
│   │   ├── event.entity.ts
│   │   ├── events.module.ts
│   │   ├── events.controller.ts     # CRUD /api/events + logo upload
│   │   └── events.service.ts
│   │
│   ├── pengkurban/                  # Pengkurban module
│   │   ├── pengkurban.entity.ts
│   │   ├── pengkurban.module.ts
│   │   ├── pengkurban.controller.ts # CRUD /api/pengkurban
│   │   ├── pengkurban.service.ts
│   │   └── dto/pengkurban.dto.ts
│   │
│   ├── vouchers/                    # Voucher module (core)
│   │   ├── voucher.entity.ts
│   │   ├── scan-log.entity.ts
│   │   ├── vouchers.module.ts
│   │   ├── vouchers.controller.ts   # CRUD + scan + PDF /api/vouchers
│   │   └── vouchers.service.ts      # QR generation, PDF generation, claiming
│   │
│   ├── dashboard/                   # Dashboard module
│   │   ├── dashboard.module.ts
│   │   ├── dashboard.controller.ts  # GET /api/dashboard/stats
│   │   └── dashboard.service.ts
│   │
│   ├── seed/                        # Auto-seed module
│   │   ├── seed.module.ts
│   │   └── seed.service.ts          # Creates default Super Admin
│   │
│   ├── app.module.ts                # Root module
│   └── main.ts                      # Bootstrap + validation pipe
│
├── uploads/                         # Uploaded files (logo, etc.)
│   └── logos/
│
├── docker-compose.yml               # PostgreSQL container
├── .env                             # Environment config
├── .gitignore
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## API Endpoints

### Auth
| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| POST | `/api/auth/login` | Login, return JWT token | Public |
| GET | `/api/auth/profile` | Get current user profile | All authenticated |

### Users
| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| GET | `/api/users` | List semua user | Super Admin |
| POST | `/api/users` | Buat user baru | Super Admin |
| PATCH | `/api/users/:id` | Update user | Super Admin |
| DELETE | `/api/users/:id` | Nonaktifkan user | Super Admin |

### Events
| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| GET | `/api/events` | List events | All authenticated |
| GET | `/api/events/:id` | Detail event | All authenticated |
| POST | `/api/events` | Buat event | Super Admin, Ketua Panitia |
| PATCH | `/api/events/:id` | Update event | Super Admin, Ketua Panitia |
| POST | `/api/events/:id/logo` | Upload logo masjid | Super Admin, Ketua Panitia |
| DELETE | `/api/events/:id` | Hapus event | Super Admin |

### Pengkurban
| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| GET | `/api/pengkurban?eventId=` | List pengkurban | Super Admin, Ketua Panitia, Panitia Voucher |
| POST | `/api/pengkurban` | Tambah pengkurban | Super Admin, Ketua Panitia, Panitia Voucher |
| PATCH | `/api/pengkurban/:id` | Update pengkurban | Super Admin, Ketua Panitia, Panitia Voucher |
| DELETE | `/api/pengkurban/:id` | Hapus pengkurban | Super Admin, Ketua Panitia, Panitia Voucher |

### Vouchers
| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| GET | `/api/vouchers?eventId=&status=&search=` | List vouchers + filter | All authenticated |
| GET | `/api/vouchers/stats?eventId=` | Statistik voucher | All authenticated |
| GET | `/api/vouchers/scan-logs?eventId=` | Riwayat scan | Super Admin, Ketua Panitia |
| GET | `/api/vouchers/:id` | Detail voucher | All authenticated |
| GET | `/api/vouchers/:id/pdf` | Download voucher PDF | All authenticated |
| POST | `/api/vouchers` | Buat 1 voucher | Super Admin, Ketua Panitia, Panitia Voucher |
| POST | `/api/vouchers/batch` | Buat batch voucher | Super Admin, Ketua Panitia, Panitia Voucher |
| POST | `/api/vouchers/scan` | Scan/klaim voucher | Super Admin, Ketua Panitia, Panitia Scanner |
| DELETE | `/api/vouchers/:id` | Hapus voucher | Super Admin, Ketua Panitia, Panitia Voucher |

### Dashboard
| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| GET | `/api/dashboard/stats?eventId=` | Statistik keseluruhan | All authenticated |

---

## Fitur Utama

### 1. Desain Voucher PDF
```
┌─────────────────────────────────┐
│         [LOGO MASJID]           │
│                                 │
│     MASJID AL HIJRAH CGE        │
│  ─────────────────────────────  │
│   KUPON PENGAMBILAN DAGING      │
│        KURBAN 2026              │
│  ─────────────────────────────  │
│     ┌─────────────────┐         │
│     │    [QR CODE]    │         │
│     └─────────────────┘         │
│   No. Voucher: QRB-2026-0001   │
│   Tanggal: Rabu, 17 Juni 2026  │
│                                 │
│  Tunjukkan kupon ini kepada     │
│  panitia untuk pengambilan      │
│  daging                         │
└─────────────────────────────────┘
```

### 2. QR Scanner
- Menggunakan kamera belakang HP via `html5-qrcode`
- Fallback input manual kode voucher
- Animasi success ✅ / error ❌
- Riwayat scan lokal

### 3. Batch Voucher
- Buat hingga 500 voucher sekaligus
- Kode otomatis sequential: QRB-{YEAR}-0001, 0002, ...

### 4. Auto Seed
- Saat pertama kali dijalankan, otomatis membuat Super Admin:
  - Username: `admin`
  - Password: `admin123`

---

## Langkah Implementasi

### Phase 1: Setup Proyek
1. ✅ Scaffold NestJS project (`npx @nestjs/cli new`)
2. ✅ Install dependencies (TypeORM, Passport, JWT, qrcode, pdfkit, dll)
3. ✅ Setup Docker Compose untuk PostgreSQL
4. ✅ Konfigurasi `.env` dan TypeORM connection
5. ✅ Setup `@nestjs/serve-static` untuk serve frontend

### Phase 2: Backend — Auth & Users
6. ✅ Buat enum: Role, AnimalType, PurchaseType, VoucherStatus
7. ✅ Buat User entity dengan role enum
8. ✅ Implementasi JWT Strategy (passport-jwt)
9. ✅ Buat `@Roles()` decorator dan `RolesGuard`
10. ✅ Buat AuthService (validate credentials, generate JWT)
11. ✅ Buat AuthController (login, profile endpoints)
12. ✅ Buat UsersService (CRUD + bcrypt password hashing)
13. ✅ Buat UsersController (Super Admin only guard)
14. ✅ Buat SeedService (auto-create admin on startup)

### Phase 3: Backend — Core Modules
15. ✅ Buat Event entity + logo_path field
16. ✅ Buat EventsService (CRUD + file upload logo)
17. ✅ Buat EventsController (dengan `FileInterceptor` untuk upload)
18. ✅ Buat Pengkurban entity (name, animal_type, purchase_type)
19. ✅ Buat PengkurbanService + Controller (CRUD + filter by event)
20. ✅ Buat Voucher entity + ScanLog entity
21. ✅ Implementasi QR code generation (`qrcode.toDataURL`)
22. ✅ Implementasi PDF generation (`pdfkit` — logo, judul, QR, kode, tanggal)
23. ✅ Implementasi voucher scan/claim logic dengan audit logging
24. ✅ Buat batch voucher creation endpoint
25. ✅ Buat delete voucher endpoint
26. ✅ Buat DashboardService (aggregate stats)

### Phase 4: Frontend
27. ✅ Buat `style.css` (glassmorphism, emerald theme, responsive, animations)
28. ✅ Buat `app.js` (API helper with JWT, sidebar nav, toast, date formatter)
29. ✅ Buat login page (`index.html`)
30. ✅ Buat dashboard page (`dashboard.html`)
31. ✅ Buat user management page (`users.html`)
32. ✅ Buat event management page (`events.html` — with logo upload)
33. ✅ Buat pengkurban page (`pengkurban.html`)
34. ✅ Buat voucher page (`vouchers.html` — filter, batch, PDF, delete)
35. ✅ Buat scanner page (`scanner.html` — camera QR + manual input)

### Phase 5: Testing & Polish
36. ✅ Fix TypeScript build errors
37. ✅ Test login flow (admin/admin123)
38. ✅ Test event creation
39. ✅ Test voucher creation (kode QRB-2026-0001 generated)
40. ✅ Fix date formatting bug
41. 🔲 Test PDF download
42. 🔲 Test QR scan flow end-to-end
43. 🔲 Test mobile responsive layout

---

## Cara Menjalankan

### Prerequisites
- Node.js 18+
- Docker (untuk PostgreSQL)

### Instalasi

```bash
# Clone repository
git clone <repo-url>
cd panitia-kurban

# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d

# Start development server
npm run start:dev

# Buka di browser
open http://localhost:3000
```

### Default Login
| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Super Admin |

### Environment Variables (`.env`)
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

---

## Daftar Tugas

### ✅ Selesai
- [x] Setup NestJS + PostgreSQL + Docker
- [x] Authentication (JWT + 4 roles)
- [x] CRUD Users (Super Admin only)
- [x] CRUD Events + upload logo
- [x] CRUD Pengkurban (nama, jenis hewan, tipe akad)
- [x] CRUD Vouchers (single + batch create)
- [x] Generate voucher PDF (QR + logo + info)
- [x] QR Scanner (kamera + manual input)
- [x] Delete voucher
- [x] Filter voucher by status & search by kode
- [x] Dashboard statistik
- [x] Scan logging (audit trail)
- [x] Auto-seed Super Admin
- [x] Responsive design (mobile bottom nav)
- [x] Glassmorphism UI theme

### 🔲 Belum / Opsional
- [ ] Export data ke CSV/Excel
- [ ] Batch PDF download (semua voucher dalam 1 file)
- [ ] Notifikasi push saat voucher diklaim
- [ ] Offline-capable scanner (PWA)
- [ ] Forgot password / reset password
- [ ] Activity log untuk semua operasi
- [ ] Unit tests & integration tests
- [ ] Production deployment guide (PM2 / Docker compose full)
