# Walkthrough — Panitia Kurban Masjid Al Hijrah CGE

Panduan penggunaan aplikasi Panitia Kurban untuk semua role pengguna.

---

## Daftar Isi

- [Memulai Aplikasi](#memulai-aplikasi)
- [Login](#login)
- [Dashboard](#dashboard)
- [Kelola Event](#kelola-event)
- [Upload Logo Masjid](#upload-logo-masjid)
- [Data Pengkurban](#data-pengkurban)
- [Kelola Voucher](#kelola-voucher)
- [Download Voucher PDF](#download-voucher-pdf)
- [Scan QR Voucher](#scan-qr-voucher)
- [Kelola User](#kelola-user)
- [Alur Kerja Lengkap](#alur-kerja-lengkap)
- [FAQ](#faq)

---

## Memulai Aplikasi

### Prerequisites
- **Node.js** 18 atau lebih baru
- **Docker** (untuk database PostgreSQL)

### Langkah-langkah

```bash
# 1. Install dependencies
npm install

# 2. Jalankan PostgreSQL via Docker
docker-compose up -d

# 3. Jalankan aplikasi (development mode)
npm run start:dev

# 4. Buka browser
# http://localhost:3000
```

> Saat pertama kali dijalankan, sistem otomatis membuat akun **Super Admin**:
> - Username: `admin`
> - Password: `admin123`

---

## Login

1. Buka `http://localhost:3000`
2. Masukkan **username** dan **password**
3. Klik tombol **Masuk**
4. Jika berhasil, Anda akan diarahkan ke **Dashboard**

> 💡 **Tips:** Klik ikon mata 👁 di sebelah kanan field password untuk menampilkan/menyembunyikan password.

---

## Dashboard

Dashboard menampilkan ringkasan data:

| Komponen | Deskripsi |
|----------|-----------|
| **Stat Cards** | Total voucher, sudah diklaim, belum diklaim, jumlah pengkurban |
| **Progress Distribusi** | Bar persentase voucher yang sudah diklaim |
| **Aktivitas Scan** | Tabel 10 scan terakhir (kode voucher, siapa yang klaim, waktu) |
| **Filter Event** | Dropdown untuk melihat stats per event tertentu |

> Semua role bisa mengakses Dashboard, tetapi data yang ditampilkan sesuai dengan konteks event yang aktif.

---

## Kelola Event

**Akses:** Super Admin, Ketua Panitia

### Membuat Event Baru
1. Buka menu **Event** di sidebar
2. Klik tombol **+ Tambah Event**
3. Isi form:
   - **Nama Event** — contoh: "Idul Adha 1447H"
   - **Tahun** — contoh: "2026" atau "1447H" (tahun ini akan tampil di voucher)
   - **Tanggal Event** — tanggal pelaksanaan
   - **Deskripsi** — opsional
4. Klik **Simpan**

### Mengedit Event
- Klik tombol **Edit** pada card event yang ingin diubah

---

## Upload Logo Masjid

**Akses:** Super Admin, Ketua Panitia

Logo yang diupload akan tampil di bagian atas voucher PDF.

1. Di halaman **Event**, cari event yang ingin ditambahkan logo
2. Klik tombol **📷 Logo**
3. Pilih file gambar (PNG, JPG, max 5MB)
4. Logo akan otomatis diupload dan ditampilkan di card event

> 💡 **Format yang disarankan:** PNG transparan, ukuran minimal 200x200 piksel, rasio 1:1 (kotak).

---

## Data Pengkurban

**Akses:** Super Admin, Ketua Panitia, Panitia Voucher

### Menambah Pengkurban
1. Buka menu **Pengkurban** di sidebar
2. Pilih **Event** di dropdown filter
3. Klik **+ Tambah Pengkurban**
4. Isi form:
   - **Event** — pilih event yang sedang berlangsung
   - **Nama Pengkurban** — nama lengkap
   - **Jenis Hewan** — Sapi 🐄, Kambing 🐐, atau Domba 🐑
   - **Tipe Akad** — "Beli via Masjid" atau "Bawa Sendiri"
   - **No. Telepon** — opsional
   - **Catatan** — opsional
5. Klik **Simpan**

### Edit & Hapus
- Klik **Edit** untuk mengubah data
- Klik **Hapus** untuk menghapus (dengan konfirmasi)

---

## Kelola Voucher

**Akses (buat/hapus):** Super Admin, Ketua Panitia, Panitia Voucher

### Membuat 1 Voucher
1. Buka menu **Voucher** di sidebar
2. Klik **+ Buat Voucher**
3. Pilih **Event** dan isi **Tanggal Distribusi**
4. Klik **Buat**
5. Voucher dengan kode unik (contoh: `QRB-2026-0001`) akan muncul di tabel

### Membuat Batch Voucher
1. Klik tombol **📦 Batch**
2. Pilih **Event**, masukkan **Jumlah** (1–500), dan isi **Tanggal Distribusi**
3. Klik **Buat Batch**
4. Semua voucher akan dibuat dengan nomor berurutan

### Filter & Cari
- **Filter Event** — pilih event di dropdown
- **Filter Status** — Aktif, Diklaim, atau Dibatalkan
- **Cari Kode** — ketik sebagian kode voucher (contoh: "0001")

### Menghapus Voucher
- Klik tombol 🗑 (merah) di kolom Aksi
- Konfirmasi penghapusan

> ⚠️ Voucher yang sudah diklaim tidak bisa dihapus dari tabel (tombol hapus hanya muncul untuk voucher dengan status **Aktif**).

---

## Download Voucher PDF

1. Di halaman **Voucher**, cari voucher yang ingin didownload
2. Klik tombol **📄 PDF** di kolom Aksi
3. File PDF akan otomatis terdownload

### Isi Voucher PDF:
```
┌─────────────────────────────────┐
│         [LOGO MASJID]           │  ← Logo yang sudah diupload
│     MASJID AL HIJRAH CGE        │
│  ─────────────────────────────  │
│   KUPON PENGAMBILAN DAGING      │
│        KURBAN 2026              │  ← Tahun dari event
│  ─────────────────────────────  │
│     ┌─────────────────┐         │
│     │    [QR CODE]    │         │  ← QR Code berisi kode voucher
│     └─────────────────┘         │
│   No. Voucher: QRB-2026-0001   │  ← Kode unik
│   Tanggal: Rabu, 17 Juni 2026  │  ← Tanggal distribusi
│                                 │
│  Tunjukkan kupon ini kepada     │
│  panitia untuk pengambilan      │
│  daging                         │
└─────────────────────────────────┘
```

> 💡 **Tips:** Print voucher PDF, lalu berikan ke warga. Saat hari distribusi, warga membawa voucher cetak dan panitia scanner melakukan scan QR.

---

## Scan QR Voucher

**Akses:** Super Admin, Ketua Panitia, Panitia Scanner

### Scan via Kamera
1. Buka menu **Scanner QR** di sidebar (atau bottom nav di HP)
2. Klik **Mulai Scan**
3. Izinkan akses kamera jika diminta browser
4. Arahkan kamera ke QR code pada voucher cetak
5. Sistem otomatis membaca QR dan memproses klaim

### Scan Manual
1. Di bagian bawah halaman scanner, ada field "Masukkan kode manual"
2. Ketik kode voucher (contoh: `QRB-2026-0001`)
3. Klik **Klaim**

### Hasil Scan
- ✅ **Berhasil** — Voucher diklaim, status berubah menjadi "Diklaim"
- ❌ **Gagal** — Voucher tidak ditemukan, sudah diklaim sebelumnya, atau sudah dibatalkan

### Riwayat Scan
- Di bagian bawah halaman scanner, terdapat riwayat scan lokal (tersimpan di browser session)

---

## Kelola User

**Akses:** Super Admin saja

### Menambah User Baru
1. Buka menu **Kelola User** di sidebar
2. Klik **+ Tambah User**
3. Isi form:
   - **Username** — minimal 3 karakter
   - **Password** — minimal 6 karakter
   - **Nama Lengkap**
   - **Role** — pilih salah satu:
     - **Super Admin** — akses penuh
     - **Ketua Panitia** — buat voucher + scan
     - **Panitia Voucher** — hanya buat voucher
     - **Panitia Scanner** — hanya scan voucher
4. Klik **Simpan**

### Menonaktifkan User
- Klik **Nonaktifkan** pada user yang ingin dinonaktifkan
- User yang dinonaktifkan tidak bisa login lagi

---

## Alur Kerja Lengkap

Berikut urutan penggunaan yang disarankan:

```
1. Super Admin login
   │
2. Buat Event baru (nama, tahun, tanggal)
   │
3. Upload logo masjid ke event
   │
4. Input data Pengkurban
   │  (nama, jenis hewan, tipe akad)
   │
5. Buat Voucher (batch, contoh: 100 voucher)
   │
6. Download & print voucher PDF
   │  (distribusikan ke warga)
   │
7. Buat akun Panitia Scanner
   │
8. Hari-H distribusi:
   │  Panitia Scanner buka halaman Scanner QR di HP
   │  Warga tunjukkan voucher cetak
   │  Panitia scan QR → daging diserahkan
   │
9. Pantau progres di Dashboard
```

---

## FAQ

### Q: Bagaimana jika lupa password admin?
Saat ini belum ada fitur reset password. Anda bisa langsung update di database PostgreSQL:
```sql
UPDATE users SET password = '$2b$10$...' WHERE username = 'admin';
```
Atau hapus user admin dan restart app (seed akan membuat ulang).

### Q: Bisa diakses dari HP?
Ya! Aplikasi sudah responsive. Di HP akan muncul **bottom navigation bar** untuk akses cepat ke menu utama.

### Q: Bagaimana jika tidak ada internet saat scan?
Scanner membutuhkan koneksi ke server untuk memvalidasi voucher. Pastikan HP terhubung ke jaringan yang sama dengan server.

### Q: Berapa maksimal voucher yang bisa dibuat sekaligus?
Batch create mendukung hingga **500 voucher** per batch.

### Q: Apakah QR code bisa di-scan oleh aplikasi QR scanner lain?
QR code berisi data JSON dengan kode voucher. Aplikasi QR scanner umum bisa membaca datanya, tapi untuk **klaim voucher** harus menggunakan scanner di aplikasi ini.
