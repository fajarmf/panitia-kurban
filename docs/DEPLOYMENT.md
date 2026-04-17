# Panduan Deployment Panitia Kurban

Aplikasi ini dapat di-deploy ke production menggunakan **Docker Compose** (disarankan) atau langsung di host menggunakan **PM2**.

## 1. Persiapan
Pastikan environment server sudah siap:
- Terinstall Node.js v20+ dan npm
- Terinstall Docker dan Docker Compose (Opsional jika pakai Docker)
- Terinstall PostgreSQL v15+ (Jika pakai PM2 / non-Docker)

## 2. Metode A: Docker Compose (Direkomendasikan)
Metode ini adalah cara termudah karena aplikasi backend dan database di-bundle dalam container.

1. Clone repository ke server production.
2. Edit password dan env file pada `docker-compose.yml` bagian `environment`.
3. Jalankan command berikut:
   ```bash
   docker-compose up -d --build
   ```
4. Aplikasi akan berjalan di port `3000`. Jika menggunakan reverse proxy seperti Nginx, proxy_pass ke `http://localhost:3000`.

## 3. Metode B: Menggunakan PM2
Jika server Anda sudah memiliki PostgreSQL dan Anda ingin menjalankan aplikasi secara langsung dengan NodeJS.

1. Install PM2 secara global:
   ```bash
   npm install -g pm2
   ```
2. Setup Database PostgreSQL. Buat database `panitia_kurban`.
3. Ubah konfigurasi `DB_HOST`, `DB_PASSWORD`, dll di dalam `ecosystem.config.js`.
4. Build aplikasi:
   ```bash
   npm ci
   npm run build
   ```
5. Jalankan menggunakan PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```
6. Opsional: Agar aplikasi berjalan otomatis ketika server restart, jalankan:
   ```bash
   pm2 startup
   ```

## Catatan:
- Pastikan folder `client/uploads` memiliki hak akses write untuk user node/docker.
- Set environment `JWT_SECRET` menjadi string yang aman dan panjang.
