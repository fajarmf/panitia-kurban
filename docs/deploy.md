# Deploy ke cPanel

Production: https://kurban.masjidalhijrahcge.id

Hosting: cPanel di shared VPS, Node.js app dikelola lewat cPanel "Setup Node.js App" (Passenger / cloudlinux-selector). Deploy **manual** via SSH + rsync.

> Host, username, dan kredensial **tidak** ditulis di repo. Lihat catatan internal panitia atau cPanel dashboard kamu.

## Prerequisite

1. **SSH access** ke cPanel server:
   - Generate keypair di lokal kalau belum ada (`ssh-keygen -t ed25519`)
   - Import public key di cPanel → **SSH Access** → **Manage SSH Keys** → **Import Key**
   - **Authorize key** setelah import (klik "Manage" → "Authorize"). Tanpa langkah ini key ga jalan walau sudah ke-import.
2. Akses ke cPanel **Setup Node.js App** (buat lihat virtualenv path & restart app).
3. Lokal: Node 20, `npm ci` sudah jalan, build sukses.

## Struktur app di server

```
~/public_html/kurban.masjidalhijrahcge.id/
├── dist/                  # compiled NestJS (replace tiap deploy)
├── client/                # static HTML/JS (replace tiap deploy)
├── public/                # asset publik
├── node_modules           # → symlink ke nodevenv (JANGAN ditimpa)
├── package.json
├── package-lock.json
├── uploads/               # runtime data — JANGAN ditimpa
├── tmp/                   # passenger restart trigger
├── stderr.log             # runtime errors
└── .htaccess              # Apache → Node app
```

## 1. Build di lokal

```bash
git checkout master
git pull origin master
npm ci
npm run build
```

Output deploy: `dist/`, `client/`, `package.json`, `package-lock.json`.

## 2. Set variable session

Jangan commit nilai ini:

```bash
export CPANEL_HOST=<host cPanel>          # cek dashboard cPanel
export CPANEL_USER=<username cPanel>      # cek "Current User" di sidebar cPanel
export REMOTE_PATH=public_html/kurban.masjidalhijrahcge.id
```

## 3. Upload via rsync

```bash
# compiled backend
rsync -avz --delete \
  --exclude='.DS_Store' \
  dist/ \
  "$CPANEL_USER@$CPANEL_HOST:$REMOTE_PATH/dist/"

# frontend static
rsync -avz --delete \
  --exclude='.DS_Store' \
  client/ \
  "$CPANEL_USER@$CPANEL_HOST:$REMOTE_PATH/client/"

# manifest (untuk npm install kalau deps berubah)
rsync -avz \
  package.json package-lock.json \
  "$CPANEL_USER@$CPANEL_HOST:$REMOTE_PATH/"
```

**Yang TIDAK boleh ke-upload:**
- `uploads/` — runtime data (bukti transfer, logo) — kalau ke-`--delete` ilang semua
- `node_modules` — symlink server, beda dengan lokal
- `.env` — secret production beda
- `tmp/`, `stderr.log` — runtime files server

## 4. Install deps (kalau berubah)

Kalau `package.json` / `package-lock.json` ga berubah, skip step ini.

**Via cPanel UI (paling gampang):**
- Buka **Setup Node.js App** → app entry kurban → klik **Run NPM Install**

**Via SSH (kalau prefer terminal):**

```bash
ssh "$CPANEL_USER@$CPANEL_HOST" <<'EOF'
source ~/nodevenv/public_html/kurban.masjidalhijrahcge.id/20/bin/activate
cd ~/public_html/kurban.masjidalhijrahcge.id
npm install --production
EOF
```

*(Path `nodevenv/.../20/bin/activate` tepatnya bisa dilihat di cPanel "Setup Node.js App" — kolom "Enter to the virtual environment".)*

## 5. Restart aplikasi

**Via SSH (recommended, scriptable):**

```bash
ssh "$CPANEL_USER@$CPANEL_HOST" "touch $REMOTE_PATH/tmp/restart.txt"
```

**Via cPanel UI:**
- **Setup Node.js App** → app entry → klik tombol **Restart**

## 6. Verifikasi

```bash
# health: public pricing endpoint
curl -fsS https://kurban.masjidalhijrahcge.id/api/public/pricing | jq .

# cek error log kalau ada anomali
ssh "$CPANEL_USER@$CPANEL_HOST" "tail -50 $REMOTE_PATH/stderr.log"
```

Buka juga halaman publik (`/daftar.html`, `/status.html`, `/donate.html`) buat sanity-check.

## Rollback

Build & deploy dari commit sebelumnya:

```bash
git checkout <commit-sha-sebelumnya>
npm ci
npm run build
# ulangi step 3-5
```

Atau revert commit di master:

```bash
git revert <commit-sha>
git push origin master
# build & deploy ulang
```

## Catatan penting

- **Build di server ga tersedia.** `npm run build` harus sukses lokal sebelum upload.
- **DB schema auto-sync** (`synchronize: true` di TypeORM). Hati-hati kalau ada rename kolom — lihat case "Migration yang pernah kehilangan data" di `CLAUDE.md` (commit `113a80e`).
- **Env vars** (`DATABASE_URL`, `JWT_SECRET`, `WA_BOT_URL`, dll) di-set sekali via cPanel "Setup Node.js App" → "Environment Variables". Tidak ada `.env` file di server.
- **`uploads/`** isi-nya kritis (bukti transfer pengkurban + donasi). Jangan pernah `--delete` ke folder ini. Backup berkala via cPanel "Backup".
- Format perubahan code yang akan masuk PR ke upstream: tetap dari branch feature → PR ke `ferisetiyawan/panitia-kurban`. Master di `fajarmf/panitia-kurban` boleh ahead untuk deploy production (izin sudah dari maintainer).

## Future: automate via GitHub Actions

Sketsa workflow yang bisa replace prosedur manual:

1. Repo secret: `CPANEL_HOST`, `CPANEL_USER`, `CPANEL_SSH_KEY` (private key).
2. Trigger: push ke `master` (atau manual `workflow_dispatch`).
3. Steps: `npm ci` → `npm run build` → setup ssh-agent → rsync `dist/`, `client/`, `package.json` → `touch tmp/restart.txt`.
4. Optional: smoke test (curl `/api/public/pricing` → assert 200).

Belum di-implement; tambah `.github/workflows/deploy.yml` kalau sudah siap pindah dari manual.
