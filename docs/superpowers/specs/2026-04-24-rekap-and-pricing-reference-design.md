# Rekap WA + pricing reference dashboard — design

**Date:** 2026-04-24
**Scope:** panitia-kurban repo (backend NestJS + frontend vanilla HTML)
**Context:** sesi reconcile data kurban Idul Adha 1447H. PR #12 (`feat/csv-include-infaq`) sudah merged — kolom `infaq_paid` + `infaq_paid_at` ada di prod + ada tombol "Tandai Lunas" di admin pengkurban UI. Rekap WA sekarang belum manfaatkan field baru itu, dan section kambing/domba belum tampilkan tier. Bendahara juga tidak punya referensi cepat tarif infaq saat verifikasi transfer masuk.

## Problem

Setelah migrasi infaq-operasional (PR #12):

1. **Rekap sumbangan** (`getDonasiRekap`) hanya tampilkan pengkurban yang sudah CONFIRMED di section "Sohibul Qurban". Warga yang mau lihat "siapa saja yang sudah berniat kurban tapi belum bayar infaq" tidak bisa karena data PENDING disembunyikan. Tidak ada centang yang menandai siapa yang sudah bayar infaq operasional vs belum.

2. **Rekap pengkurban** (`getPengkurbanRekap`) masih gunakan `status === CONFIRMED` sebagai marker ✅, padahal caption-nya menyatakan "✅ = sudah verifikasi infaq". Caption dan semantik tidak konsisten sejak PR #12.

3. **Section kambing/domba** di rekap pengkurban tidak tampilkan tier/ukuran. Hadi Yuda (Domba Tipe A, 2.95 jt) dan kambing Super (9 jt) di-treat sama saja — informasi tier hilang di broadcast grup.

4. **Bendahara verifikasi transfer masuk** tidak punya referensi tarif cepat. Setiap kali ada transfer masuk, bendahara mesti buka dokumen eksternal atau tanya panitia lain untuk cek "harga Kambing Tipe B berapa?". Admin pengkurban list juga tidak tampilkan expected total (harga + infaq), hanya kolom price DB — susah spot kalau nominal transfer tidak cocok.

## Solution

Empat perubahan terkoordinasi di satu PR:

### Part 1 — `getDonasiRekap()` behavior change

File: `src/rekap/rekap.service.ts`

**Section "Sohibul Qurban"**: ubah filter dari `status === CONFIRMED` jadi `status !== REJECTED` (active pengkurban, sama dengan pattern di `getPengkurbanRekap`). Tambah marker ✅ di baris yang `infaqPaid === true`.

**Section "Sukarela Warga"**: filter sudah active (tetap). Tambah marker ✅ di baris yang `status === CONFIRMED`.

**Footer**: tambah baris `Donasi online` sebelum baris `Konfirmasi`. `Konfirmasi` line tampilkan dua kontak WA (owner + asisten panitia).

Contoh final output:

```
*List Sumbangan Kegiatan Idul Qurban*

• Sohibul Qurban
1. Asep Jamaluddin 300 ribu ✅
2. Margono bin Sudiran Arifin 300 ribu ✅
3. Mochamad Nilam Maryadi 300 ribu
4. Hadi Yuda Ramdhani 300 ribu
5. Andika Bayu Danukusumah 300 ribu ✅
6. Fajar Maulana Firdaus 1750 ribu
7. Harmansah bin H. Zaharuddin 300 ribu
8. Radar Buana 300 ribu

• Sukarela Warga
1. Fajar Maulana Firdaus 500 ribu

Rekening Bank Muamalat | 12 1010 4479 a/n Masjid Al Hijrah CGE 11

Donasi online: https://kurban.masjidalhijrahcge.id/donate.html

Konfirmasi di https://kurban.masjidalhijrahcge.id atau Whatsapp ke Fajar Firdaus (0812-7149-927) / Panitia Kurban (0851-2151-9870).

Jazakumullahu Khairan.

Panitia Idul Adha 1447 H
DKM Al Hijrah – Cluster Maranos CGE
```

### Part 2 — `getPengkurbanRekap()` changes

File: `src/rekap/rekap.service.ts`

**Change A — ✅ semantic switch**. Fungsi `check()` switch dari `d.status === 'CONFIRMED'` jadi `d.infaqPaid === true`. Caption teks "✅ = sudah verifikasi infaq" tidak berubah (sudah benar secara semantik, hanya kode-nya yang tadi tidak sesuai).

**Change B — Kambing/Domba tier per-row**. Format baris tiap pengkurban kambing/domba tambah info `animal_size`:
- Size terisi: `1. Hadi Yuda (Domba - Tipe A)`
- Size null: `1. Harmansah (Kambing)` (fallback, tidak break existing data)

Pengelompokan tetap sebagai satu section gabungan "Qurban Kambing dan Domba" (tidak di-split, sesuai preference user).

### Part 3 — Pricing reference card di `/dashboard.html`

File: `client/dashboard.html`

Tambah section baru di bawah grid stats. Isi: tabel tarif kurban + infaq operasional, read-only reference untuk bendahara.

Struktur card:

- Group "Sapi Kolektif": Sapi A (4 jt + infaq 300 rb = 4.3 jt), Sapi B (3.5 jt + infaq 300 rb = 3.8 jt)
- Group "Sapi Perorangan": harga kesepakatan + infaq 1.75 jt (note: bendahara catat harga sapi di field `price` saat input)
- Group "Kambing": 5 baris tier (A/B/C/Super/Istimewa) dengan harga masing-masing, footnote infaq 300 rb
- Group "Domba": sama struktur seperti Kambing

**Data source**: fetch dari `/api/public/pricing` (sudah ada). Infaq info di-inject dari expanded endpoint (lihat Part 5).

### Part 4 — Expected-price column di `/pengkurban.html` admin table

File: `client/pengkurban.html`

Tambah kolom baru **"Perkiraan Total"** di table admin pengkurban. Value dihitung di client-side dari `animal_type + animal_size + price` lookup ke pricing catalog + infaq map.

Logic:
- `SAPI_KOLEKTIF_A` / `SAPI_KOLEKTIF_B`: flat price dari catalog + infaq 300 rb
- `SAPI_PERORANGAN`: `row.price` (dari DB, diisi bendahara saat input) + infaq 1.75 jt; kalau `price` null tampil `(harga belum diisi)`
- `KAMBING` / `DOMBA`: lookup tier dari `animal_size` → price catalog + infaq 300 rb; kalau size null tampil `(tier belum diisi)`
- Super tier (range priceMin-priceMax): tampil sebagai range, bendahara cross-check manual

Format kolom: `4.000.000 + 300.000 = 4.300.000` (atau ringkas `4.3 jt` — tentukan saat impl).

Manfaat: bendahara saat verifikasi klik row, langsung bisa cek apakah transfer masuk matching dengan "Perkiraan Total" tanpa lihat dokumen tarif terpisah.

### Part 5 — Pricing endpoint expansion

File: `src/pengkurban/public-pengkurban.controller.ts` (method `getPricing`)

Tambah field `infaq` di setiap entry response supaya pricing catalog jadi single source of truth untuk frontend (dashboard card + pengkurban admin column) dan backend (rekap.service.ts bisa derive).

Shape tambahan (backward-compat, hanya penambahan):

```ts
{
  domba: [
    { size: 'Tipe A', weight: '30 kg', price: 2950000, infaq: 300000 },
    ...
  ],
  kambing: [...same...],
  sapiKolektif: {
    opsiA: { perOrang: 4000000, beratSapi: '350-400 kg', label: 'Sapi A', infaq: 300000 },
    opsiB: {...},
    orangPerEkor: 7,
    jenisSapi: 'Sapi Bali',
  },
  sapiPerorangan: {
    infaq: 1750000,
    note: 'Harga sesuai kesepakatan'
  }
}
```

Rekap service bisa baca pricing dari endpoint yang sama atau share konstanta. Pilihan paling simple: extract `INFAQ` map di `rekap.service.ts` dan pricing catalog di `public-pengkurban.controller.ts` ke satu file konstan shared (e.g. `src/common/pricing.constants.ts`), import dari kedua tempat. Tidak perlu fetch endpoint internal.

## Architecture

```
┌─────────────────────────────────────────────┐
│  src/common/pricing.constants.ts  (NEW)     │
│  - PRICING catalog (domba, kambing, sapi)   │
│  - INFAQ map per animal_type                │
└────────────┬────────────────────────────────┘
             │ imports
     ┌───────┼──────────────┐
     ▼       ▼              ▼
┌─────────┐ ┌───────────┐ ┌──────────────────────┐
│ rekap   │ │ public-   │ │ (future: export di   │
│ service │ │ pengkurban│ │  /api/public/pricing)│
└─────────┘ └───────────┘ └──────────────────────┘
                  │
                  ▼
         GET /api/public/pricing
            (enhanced response)
                  │
                  ▼
     ┌────────────┴────────────┐
     ▼                         ▼
dashboard.html         pengkurban.html
(pricing card)         (expected-price col)
```

Backend changes: 1 new file (`pricing.constants.ts`) + 2 file refactored (`rekap.service.ts` import konstanta, `public-pengkurban.controller.ts` import konstanta + tambah `infaq` field di response).

Frontend changes: 2 file (`dashboard.html` + section card, `pengkurban.html` + column logic).

## Data flow

1. User input pengkurban (admin atau public form) → DB save `animal_type`, `animal_size`, `price`.
2. Admin verify payment → status CONFIRMED.
3. Admin toggle "Tandai Lunas" (PR #12) → `infaq_paid = true`.
4. Rekap WA generated → pakai `infaq_paid` untuk ✅, pakai `animal_size` untuk tier label.
5. Bendahara verifikasi transfer → lihat expected total di `/pengkurban.html` + pricing reference di `/dashboard.html`.

## Test plan

### Unit tests (`src/rekap/rekap.service.spec.ts`)

Skenario baru:

1. `getDonasiRekap` — sohibul mixed status: 1 CONFIRMED+infaqPaid, 1 CONFIRMED+!infaqPaid, 1 PENDING_PAYMENT. Expect 3 baris dengan ✅ hanya di #1.
2. `getDonasiRekap` — donasi mixed status: 1 CONFIRMED, 1 PENDING_VERIFICATION. Expect 2 baris dengan ✅ hanya di #1.
3. `getDonasiRekap` — footer: cek baris `Donasi online` + dual-phone string muncul persis sekali, urutan benar.
4. `getPengkurbanRekap` — ✅ semantic: 1 CONFIRMED+!infaqPaid (harus TANPA ✅), 1 PENDING+infaqPaid (harus DENGAN ✅ — edge case).
5. `getPengkurbanRekap` — kambing/domba format: 1 row size="Tipe A", 1 row size=null. Expect format sesuai.

### Manual UI smoke

- Buka admin `/pengkurban.html` → klik tombol "Rekap WA" → copy → paste ke chat WA sendiri → verify format match rekap sumbangan + pengkurban mockup.
- Buka `/dashboard.html` → verify pricing reference card muncul, tabel render benar untuk 5 group.
- Buka `/pengkurban.html` list → verify kolom "Perkiraan Total" untuk 8 row existing:
  - Sapi Kolektif A rows (Asep, Margono, Nilam, Andika, Radar): `4.3 jt`
  - Domba (Hadi Yuda, Tipe A): `2.95 jt + 300rb = 3.25 jt`
  - Kambing (Harmansah, size null): `(tier belum diisi)`
  - Sapi Perorangan (Fajar, price null): `(harga belum diisi)`

### Manual data ops (separate, not in scope tapi prerequisite untuk demo)

- Set `animal_size` untuk REG-0009 Harmansah (Kambing) setelah konfirmasi dari Bu Jihan.
- Set `animal_size` + `price` untuk REG-0006 Fajar (Sapi Perorangan) setelah finalize.

## Non-goals

- Edit UI behavior (admin pengkurban toggle "Tandai Lunas" — sudah ada, tidak diubah).
- Migration schema tambahan (sudah cukup dengan PR #12 schema).
- Revamp style pricing card (pakai Tailwind util existing, tidak nambah CSS baru).
- Multi-event pricing (catalog global, tidak per-event. Kalau nanti event 1448H beda harga, refactor belakangan).
- Backfill `infaq_paid` untuk CONFIRMED existing (sudah dilakukan istri via admin UI saat sesi ini).
- Admin user interface untuk edit pricing catalog (constant hardcoded, update lewat commit).
- Rekap caching atau paginate (volume kecil, <50 pengkurban).

## Risk & mitigation

- **Duplicate source of truth**: sekarang `INFAQ` di `rekap.service.ts` + pricing catalog di `public-pengkurban.controller.ts`. Mitigation: extract ke `src/common/pricing.constants.ts` dan import dari kedua tempat. Single place update.
- **Client-side expected-price calculation bug**: edge case jika `animal_size` berisi string non-standard (historic data). Mitigation: fallback branch `(tier belum diisi)` kalau tidak match enum tier.
- **Public pricing endpoint shape change breaks external consumer**: backward-compat, kita hanya add field. Existing consumer (kalau ada) tetap jalan.
- **Rekap format regression**: unit test baru meng-cover skenario ✅ dan tier. Tapi ada risiko typo di footer template — mitigation: test #3 assert footer string exactly.

## Open questions / follow-up

- Apakah perlu save history `infaq_paid_at` changes (audit)? Current PR #12 hanya simpan timestamp terakhir, tidak immutable log. Kalau ada concern audit, tambah entry ke `activity_logs` saat toggle. Tidak urgent.
- Kambing/Domba "Super" tier range (priceMin-priceMax): pengkurban actual pilih harga di range itu. Field `price` di DB mana yang dipakai? Saat ini `animal_size = 'Super'` + `price = actual agreed amount`. Expected-price column: tampil range `5.6-9 jt + 300rb` atau pakai `price` field? **Keputusan**: tampil range (supaya bendahara sadar kalau transfer di bawah/atas range). Tidak pakai `price` field untuk range tier.
- Footer dual-phone formatting: sekarang desain `Fajar Firdaus (0812-7149-927) / Panitia Kurban (0851-2151-9870)`. Kalau user ingin bahasa lain (e.g. "atau" instead of "/"), bisa adjust saat impl.
