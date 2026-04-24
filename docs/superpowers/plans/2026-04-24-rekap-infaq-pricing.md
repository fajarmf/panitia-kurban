# Rekap Infaq + Pricing Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bikin rekap WA (pengkurban & sumbangan) pakai field `infaq_paid` untuk marker ✅, tampilkan tier per-row kambing/domba, kasih referensi tarif di dashboard + kolom perkiraan total di admin pengkurban supaya bendahara cepat cross-check transfer masuk.

**Architecture:** Extract pricing catalog + INFAQ map ke `src/common/pricing.constants.ts` sebagai single source of truth. Backend (`rekap.service.ts`, `public-pengkurban.controller.ts`) import dari situ. Frontend (`dashboard.html`, `pengkurban.html`) fetch via `/api/public/pricing` endpoint yang diperluas dengan field `infaq` per entry.

**Tech Stack:** NestJS 10 + TypeORM (backend), Jest (tests), Vanilla HTML + Tailwind CDN + fetch() (frontend).

**Spec:** `docs/superpowers/specs/2026-04-24-rekap-and-pricing-reference-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/common/pricing.constants.ts` | Central catalog: PRICING + INFAQ | Create |
| `src/rekap/rekap.service.ts` | Rekap text generator | Modify |
| `src/rekap/rekap.service.spec.ts` | Unit tests for rekap | Create |
| `src/pengkurban/public-pengkurban.controller.ts` | Public pricing endpoint | Modify (import constants, add `infaq` to response) |
| `client/dashboard.html` | Add pricing reference card | Modify |
| `client/pengkurban.html` | Add "Perkiraan Total" column | Modify (+ remove local INFAQ const, fetch pricing from endpoint) |

Each task below is self-contained. Commit after each task. Branch `feat/rekap-infaq-pricing` already exists with spec commit.

---

## Task 1: Create shared pricing constants

**Files:**
- Create: `src/common/pricing.constants.ts`

- [ ] **Step 1: Write the file**

Create `src/common/pricing.constants.ts`:

```typescript
import { AnimalType } from './enums/animal-type.enum';

export interface TierPrice {
  size: string;
  weight: string;
  price?: number;
  priceMin?: number;
  priceMax?: number;
  priceNote?: string;
  infaq: number;
}

export interface SapiKolektifOption {
  perOrang: number;
  beratSapi: string;
  label: string;
  infaq: number;
}

export interface PricingCatalog {
  domba: TierPrice[];
  kambing: TierPrice[];
  sapiKolektif: {
    opsiA: SapiKolektifOption;
    opsiB: SapiKolektifOption;
    orangPerEkor: number;
    jenisSapi: string;
  };
  sapiPerorangan: {
    infaq: number;
    note: string;
  };
}

const INFAQ_KAMBING_DOMBA = 300_000;
const INFAQ_SAPI_KOLEKTIF = 300_000;
const INFAQ_SAPI_PERORANGAN = 1_750_000;

export const PRICING: PricingCatalog = {
  domba: [
    { size: 'Tipe A', weight: '30 kg', price: 2_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe B', weight: '40 kg', price: 3_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe C', weight: '50 kg', price: 4_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Super', weight: '60-90 kg', priceMin: 5_600_000, priceMax: 9_000_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Istimewa', weight: '>100 kg', priceNote: 'hubungi panitia', infaq: INFAQ_KAMBING_DOMBA },
  ],
  kambing: [
    { size: 'Tipe A', weight: '30 kg', price: 3_000_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe B', weight: '40 kg', price: 3_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe C', weight: '50 kg', price: 5_000_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Super', weight: '60-90 kg', priceMin: 5_650_000, priceMax: 9_200_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Istimewa', weight: '>100 kg', priceNote: 'hubungi panitia', infaq: INFAQ_KAMBING_DOMBA },
  ],
  sapiKolektif: {
    opsiA: { perOrang: 4_000_000, beratSapi: '350-400 kg', label: 'Sapi A', infaq: INFAQ_SAPI_KOLEKTIF },
    opsiB: { perOrang: 3_500_000, beratSapi: '320-350 kg', label: 'Sapi B', infaq: INFAQ_SAPI_KOLEKTIF },
    orangPerEkor: 7,
    jenisSapi: 'Sapi Bali',
  },
  sapiPerorangan: {
    infaq: INFAQ_SAPI_PERORANGAN,
    note: 'Harga sesuai kesepakatan',
  },
};

export const INFAQ_BY_ANIMAL: Record<string, number> = {
  [AnimalType.DOMBA]: INFAQ_KAMBING_DOMBA,
  [AnimalType.KAMBING]: INFAQ_KAMBING_DOMBA,
  [AnimalType.SAPI_KOLEKTIF]: INFAQ_SAPI_KOLEKTIF,
  [AnimalType.SAPI_KOLEKTIF_A]: INFAQ_SAPI_KOLEKTIF,
  [AnimalType.SAPI_KOLEKTIF_B]: INFAQ_SAPI_KOLEKTIF,
  [AnimalType.SAPI_PERORANGAN]: INFAQ_SAPI_PERORANGAN,
};
```

- [ ] **Step 2: Verify compiles**

Run: `cd /Users/fajarfirdaus/Development/panitia-kurban && npx tsc --noEmit`
Expected: No new errors. (Existing errors from other files, if any, are unrelated.)

- [ ] **Step 3: Commit**

```bash
git add src/common/pricing.constants.ts
git commit -m "feat(common): extract pricing + infaq catalog ke constants"
```

---

## Task 2: Refactor `public-pengkurban.controller.ts` to return infaq + use shared catalog

**Files:**
- Modify: `src/pengkurban/public-pengkurban.controller.ts`
- Test: `src/pengkurban/public-pengkurban.controller.spec.ts` (create)

- [ ] **Step 1: Write failing test**

Create `src/pengkurban/public-pengkurban.controller.spec.ts`:

```typescript
import { PublicPengkurbanController } from './public-pengkurban.controller';
import { PricingCatalog } from '../common/pricing.constants';

describe('PublicPengkurbanController.getPricing', () => {
  let controller: PublicPengkurbanController;

  beforeEach(() => {
    controller = new PublicPengkurbanController(
      {} as any, // pengkurbanService not used in getPricing
    );
  });

  it('returns infaq field per tier for domba/kambing', () => {
    const result: PricingCatalog = controller.getPricing() as PricingCatalog;
    expect(result.domba[0].infaq).toBe(300_000);
    expect(result.kambing[0].infaq).toBe(300_000);
    expect(result.domba.every((t) => t.infaq === 300_000)).toBe(true);
    expect(result.kambing.every((t) => t.infaq === 300_000)).toBe(true);
  });

  it('returns infaq for sapi kolektif opsi A & B', () => {
    const result: PricingCatalog = controller.getPricing() as PricingCatalog;
    expect(result.sapiKolektif.opsiA.infaq).toBe(300_000);
    expect(result.sapiKolektif.opsiB.infaq).toBe(300_000);
  });

  it('returns infaq for sapi perorangan', () => {
    const result: PricingCatalog = controller.getPricing() as PricingCatalog;
    expect(result.sapiPerorangan.infaq).toBe(1_750_000);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `npx jest src/pengkurban/public-pengkurban.controller.spec.ts`
Expected: FAIL — `result.domba[0].infaq` undefined.

- [ ] **Step 3: Refactor controller to import + return catalog**

Replace the `getPricing()` body in `src/pengkurban/public-pengkurban.controller.ts` (currently lines 67-101) with:

```typescript
  @Get('pricing')
  getPricing() {
    return PRICING;
  }
```

And add to imports at top of file:

```typescript
import { PRICING } from '../common/pricing.constants';
```

- [ ] **Step 4: Run test — expect pass**

Run: `npx jest src/pengkurban/public-pengkurban.controller.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pengkurban/public-pengkurban.controller.ts src/pengkurban/public-pengkurban.controller.spec.ts
git commit -m "refactor(pengkurban): pricing endpoint pakai shared catalog + field infaq"
```

---

## Task 3: Set up `rekap.service.spec.ts` with fixtures

**Files:**
- Create: `src/rekap/rekap.service.spec.ts`

- [ ] **Step 1: Write baseline test file**

Create `src/rekap/rekap.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { RekapService } from './rekap.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Pengkurban } from '../pengkurban/pengkurban.entity';
import { Donation } from '../donations/donation.entity';

describe('RekapService', () => {
  let service: RekapService;
  const pengkurbanRepo = { find: jest.fn() };
  const donationRepo = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RekapService,
        { provide: getRepositoryToken(Pengkurban), useValue: pengkurbanRepo },
        { provide: getRepositoryToken(Donation), useValue: donationRepo },
      ],
    }).compile();
    service = module.get<RekapService>(RekapService);
  });

  afterEach(() => jest.clearAllMocks());

  const makePk = (overrides: Partial<Pengkurban> = {}): Pengkurban => ({
    id: overrides.id ?? 'id-1',
    name: overrides.name ?? 'Nama',
    shohibulName: overrides.shohibulName ?? null,
    animalType: overrides.animalType ?? ('SAPI_KOLEKTIF_A' as any),
    animalSize: overrides.animalSize ?? null,
    status: overrides.status ?? ('CONFIRMED' as any),
    infaqPaid: overrides.infaqPaid ?? false,
    infaqPaidAt: overrides.infaqPaidAt ?? null,
  } as Pengkurban);

  const makeDonation = (overrides: Partial<Donation> = {}): Donation => ({
    id: overrides.id ?? 'd-1',
    name: overrides.name ?? 'Donor',
    amount: overrides.amount ?? 100000,
    status: overrides.status ?? ('CONFIRMED' as any),
  } as Donation);

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect 1 test pass**

Run: `npx jest src/rekap/rekap.service.spec.ts`
Expected: PASS (1 test — "should be defined").

- [ ] **Step 3: Commit**

```bash
git add src/rekap/rekap.service.spec.ts
git commit -m "test(rekap): scaffold spec dengan fixtures"
```

---

## Task 4: `getDonasiRekap` — sohibul show all active + ✅ for infaqPaid

**Files:**
- Modify: `src/rekap/rekap.service.ts:126-153` (section "Sohibul Qurban")
- Modify: `src/rekap/rekap.service.spec.ts` (add test)

- [ ] **Step 1: Write failing test**

Append to `src/rekap/rekap.service.spec.ts`, inside `describe('RekapService', ...)`:

```typescript
  describe('getDonasiRekap — sohibul section', () => {
    it('shows all non-rejected pengkurban with ✅ only when infaqPaid=true', async () => {
      pengkurbanRepo.find.mockResolvedValue([
        makePk({ name: 'Confirmed Lunas', status: 'CONFIRMED' as any, infaqPaid: true }),
        makePk({ name: 'Confirmed Belum', status: 'CONFIRMED' as any, infaqPaid: false }),
        makePk({ name: 'Pending Lunas', status: 'PENDING_PAYMENT' as any, infaqPaid: true }),
        makePk({ name: 'Pending Belum', status: 'PENDING_PAYMENT' as any, infaqPaid: false }),
        makePk({ name: 'Rejected', status: 'REJECTED' as any, infaqPaid: false }),
      ]);
      donationRepo.find.mockResolvedValue([]);

      const text = await service.getDonasiRekap();

      expect(text).toContain('1. Confirmed Lunas 300 ribu ✅');
      expect(text).toContain('2. Confirmed Belum 300 ribu');
      expect(text).not.toContain('Confirmed Belum 300 ribu ✅');
      expect(text).toContain('3. Pending Lunas 300 ribu ✅');
      expect(text).toContain('4. Pending Belum 300 ribu');
      expect(text).not.toContain('Rejected');
    });
  });
```

- [ ] **Step 2: Run — expect fail**

Run: `npx jest src/rekap/rekap.service.spec.ts -t "sohibul"`
Expected: FAIL. Current code only includes CONFIRMED; "Pending Lunas" absent from output; no ✅ attached.

- [ ] **Step 3: Refactor service**

In `src/rekap/rekap.service.ts`, replace section "Sohibul Qurban" block (currently lines 141-152) with:

```typescript
    // Sohibul Qurban — semua active (non-REJECTED), ✅ kalau infaq_paid
    const pkActive = pengkurban.filter(
      (d) => d.status !== ('REJECTED' as never),
    );
    lines.push(`• Sohibul Qurban`);
    if (pkActive.length) {
      pkActive.forEach((d, i) => {
        const name = displayName(d);
        const amt = formatRibu(INFAQ_BY_ANIMAL[d.animalType as string] ?? 0);
        const check = d.infaqPaid ? ' ✅' : '';
        lines.push(`${i + 1}. ${name}${amt ? ' ' + amt : ''}${check}`);
      });
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);
```

And remove the now-unused local `pkConfirmed` variable above. Also remove the `INFAQ` constant at top (lines 7-14) — replaced by import. At top of file, add import:

```typescript
import { INFAQ_BY_ANIMAL } from '../common/pricing.constants';
```

Then delete the local `const INFAQ: Record<string, number> = { ... };` block (lines 7-14).

Rest of function (the `INFAQ[d.animalType...]` reference earlier) is also used? Let me check — no, `INFAQ` is only used in `getDonasiRekap`. After replacement, all references go to `INFAQ_BY_ANIMAL`. Confirmed safe to remove local const.

- [ ] **Step 4: Run — expect pass**

Run: `npx jest src/rekap/rekap.service.spec.ts -t "sohibul"`
Expected: PASS.

- [ ] **Step 5: Run full rekap spec**

Run: `npx jest src/rekap/rekap.service.spec.ts`
Expected: PASS (2 tests — "should be defined" + "sohibul section").

- [ ] **Step 6: Commit**

```bash
git add src/rekap/rekap.service.ts src/rekap/rekap.service.spec.ts
git commit -m "feat(rekap): sohibul section tampil semua active + ✅ pakai infaq_paid"
```

---

## Task 5: `getDonasiRekap` — donasi ✅ for CONFIRMED

**Files:**
- Modify: `src/rekap/rekap.service.ts:154-164` (section "Sukarela Warga")
- Modify: `src/rekap/rekap.service.spec.ts`

- [ ] **Step 1: Write failing test**

Append to `describe('RekapService')`:

```typescript
  describe('getDonasiRekap — sukarela warga section', () => {
    it('shows ✅ only for CONFIRMED donations', async () => {
      pengkurbanRepo.find.mockResolvedValue([]);
      donationRepo.find.mockResolvedValue([
        makeDonation({ name: 'Donor A', amount: 500000, status: 'CONFIRMED' as any }),
        makeDonation({ name: 'Donor B', amount: 300000, status: 'PENDING_VERIFICATION' as any }),
        makeDonation({ name: 'Donor C', amount: 100000, status: 'REJECTED' as any }),
      ]);

      const text = await service.getDonasiRekap();

      expect(text).toContain('1. Donor A 500 ribu ✅');
      expect(text).toContain('2. Donor B 300 ribu');
      expect(text).not.toContain('Donor B 300 ribu ✅');
      expect(text).not.toContain('Donor C');
    });
  });
```

- [ ] **Step 2: Run — expect fail**

Run: `npx jest src/rekap/rekap.service.spec.ts -t "sukarela warga"`
Expected: FAIL — no ✅ on `Donor A`.

- [ ] **Step 3: Modify service**

Replace the "Sukarela Warga" block in `src/rekap/rekap.service.ts` with:

```typescript
    // Sukarela Warga — semua active (non-REJECTED), ✅ kalau CONFIRMED
    lines.push(`• Sukarela Warga`);
    if (activeDonations.length) {
      activeDonations.forEach((d, i) => {
        const amt = formatRibu(d.amount == null ? null : Number(d.amount));
        const check = d.status === ('CONFIRMED' as never) ? ' ✅' : '';
        lines.push(`${i + 1}. ${d.name}${amt ? ' ' + amt : ''}${check}`);
      });
    } else {
      [1, 2, 3, 4, 5].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest src/rekap/rekap.service.spec.ts`
Expected: all PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rekap/rekap.service.ts src/rekap/rekap.service.spec.ts
git commit -m "feat(rekap): sukarela warga pakai ✅ untuk CONFIRMED"
```

---

## Task 6: `getDonasiRekap` — footer daftar link + dual phone

**Files:**
- Modify: `src/rekap/rekap.service.ts:166-178` (footer block)
- Modify: `src/rekap/rekap.service.spec.ts`

- [ ] **Step 1: Write failing test**

Append:

```typescript
  describe('getDonasiRekap — footer', () => {
    it('includes rekening + donate link + dual phone', async () => {
      pengkurbanRepo.find.mockResolvedValue([]);
      donationRepo.find.mockResolvedValue([]);

      const text = await service.getDonasiRekap();

      expect(text).toContain('Rekening Bank Muamalat | 12 1010 4479 a/n Masjid Al Hijrah CGE 11');
      expect(text).toContain('Donasi online: https://kurban.masjidalhijrahcge.id/donate.html');
      expect(text).toContain('Fajar Firdaus (0812-7149-927)');
      expect(text).toContain('Panitia Kurban (0851-2151-9870)');
    });
  });
```

- [ ] **Step 2: Run — expect fail**

Run: `npx jest src/rekap/rekap.service.spec.ts -t "footer"`
Expected: FAIL — "Donasi online" line missing, Panitia Kurban phone missing.

- [ ] **Step 3: Modify service footer**

Replace footer block in `src/rekap/rekap.service.ts` (lines starting from `lines.push(\`Rekening Bank ...`) with:

```typescript
    lines.push(
      `Rekening Bank Muamalat | 12 1010 4479 a/n Masjid Al Hijrah CGE 11`,
    );
    lines.push(``);
    lines.push(`Donasi online: https://kurban.masjidalhijrahcge.id/donate.html`);
    lines.push(``);
    lines.push(`Konfirmasi`);
    lines.push(
      `di: https://kurban.masjidalhijrahcge.id  atau Whatsapp ke Fajar Firdaus (0812-7149-927) / Panitia Kurban (0851-2151-9870).`,
    );
    lines.push(``);
    lines.push(`Jazakumullahu Khairan.`);
    lines.push(``);
    lines.push(`Panitia Idul Adha 1447 H`);
    lines.push(`DKM Al Hijrah – Cluster Maranos CGE`);
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest src/rekap/rekap.service.spec.ts`
Expected: all PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rekap/rekap.service.ts src/rekap/rekap.service.spec.ts
git commit -m "feat(rekap): footer sumbangan tambah link donasi + nomor panitia"
```

---

## Task 7: `getPengkurbanRekap` — ✅ pakai infaqPaid

**Files:**
- Modify: `src/rekap/rekap.service.ts:54-124`
- Modify: `src/rekap/rekap.service.spec.ts`

- [ ] **Step 1: Write failing test**

Append:

```typescript
  describe('getPengkurbanRekap — ✅ logic', () => {
    it('✅ based on infaqPaid, not status', async () => {
      pengkurbanRepo.find.mockResolvedValue([
        makePk({ name: 'Confirmed Lunas', animalType: 'SAPI_KOLEKTIF_A' as any, status: 'CONFIRMED' as any, infaqPaid: true }),
        makePk({ name: 'Confirmed Belum', animalType: 'SAPI_KOLEKTIF_A' as any, status: 'CONFIRMED' as any, infaqPaid: false }),
        makePk({ name: 'Pending Lunas', animalType: 'SAPI_KOLEKTIF_A' as any, status: 'PENDING_PAYMENT' as any, infaqPaid: true }),
      ]);

      const text = await service.getPengkurbanRekap();

      expect(text).toContain('1. Confirmed Lunas ✅');
      expect(text).toContain('2. Confirmed Belum');
      expect(text).not.toContain('Confirmed Belum ✅');
      expect(text).toContain('3. Pending Lunas ✅');
    });
  });
```

- [ ] **Step 2: Run — expect fail**

Run: `npx jest src/rekap/rekap.service.spec.ts -t "✅ logic"`
Expected: FAIL — current code uses status === CONFIRMED.

- [ ] **Step 3: Modify service**

In `src/rekap/rekap.service.ts`, replace the `check` function inside `getPengkurbanRekap()` (currently line 70-71):

```typescript
    const check = (d: Pengkurban) =>
      d.infaqPaid ? ' ✅' : '';
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest src/rekap/rekap.service.spec.ts`
Expected: all PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rekap/rekap.service.ts src/rekap/rekap.service.spec.ts
git commit -m "feat(rekap): ✅ pengkurban pakai infaq_paid (konsisten dengan caption)"
```

---

## Task 8: `getPengkurbanRekap` — kambing/domba tier per row

**Files:**
- Modify: `src/rekap/rekap.service.ts:107-116`
- Modify: `src/rekap/rekap.service.spec.ts`

- [ ] **Step 1: Write failing test**

Append:

```typescript
  describe('getPengkurbanRekap — kambing/domba tier', () => {
    it('shows tier from animalSize per row', async () => {
      pengkurbanRepo.find.mockResolvedValue([
        makePk({ name: 'Hadi', animalType: 'DOMBA' as any, animalSize: 'Tipe A', infaqPaid: false }),
        makePk({ name: 'Siti', animalType: 'KAMBING' as any, animalSize: 'Tipe B', infaqPaid: true }),
        makePk({ name: 'Budi', animalType: 'KAMBING' as any, animalSize: null, infaqPaid: false }),
      ]);

      const text = await service.getPengkurbanRekap();

      expect(text).toContain('1. Hadi (Domba - Tipe A)');
      expect(text).toContain('2. Siti (Kambing - Tipe B) ✅');
      expect(text).toContain('3. Budi (Kambing)');
      expect(text).not.toContain('Budi (Kambing - null)');
      expect(text).not.toContain('Budi (Kambing - )');
    });
  });
```

- [ ] **Step 2: Run — expect fail**

Run: `npx jest src/rekap/rekap.service.spec.ts -t "kambing/domba tier"`
Expected: FAIL — current code outputs `1. Hadi (Domba)` without tier.

- [ ] **Step 3: Modify service**

Replace kambing/domba block in `getPengkurbanRekap()` with:

```typescript
    lines.push(`Qurban Kambing dan Domba`);
    if (kambingDomba.length) {
      kambingDomba.forEach((d, i) => {
        const jenis = d.animalType === ('DOMBA' as never) ? 'Domba' : 'Kambing';
        const tier = d.animalSize ? ` - ${d.animalSize}` : '';
        lines.push(`${i + 1}. ${displayName(d)} (${jenis}${tier})${check(d)}`);
      });
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest src/rekap/rekap.service.spec.ts`
Expected: all PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rekap/rekap.service.ts src/rekap/rekap.service.spec.ts
git commit -m "feat(rekap): kambing/domba tampil tier per row"
```

---

## Task 9: Build check + push + spot-check rekap output against prod data

**Files:** none modified

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Build success, no TypeScript errors.

- [ ] **Step 2: Run ALL backend tests**

Run: `npm run test -- --testPathIgnorePatterns=dist`
Expected: all pass.

- [ ] **Step 3: Spot-check rekap output locally (dry-run style)**

Create temp script `/tmp/check-rekap.ts` (not committed):

```typescript
// Run with: npx ts-node /tmp/check-rekap.ts
// Prints rekap text for visual verification using real prod data.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './dist/app.module';
import { RekapService } from './dist/rekap/rekap.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const svc = app.get(RekapService);
  console.log('\n=== PENGKURBAN REKAP ===\n');
  console.log(await svc.getPengkurbanRekap());
  console.log('\n\n=== DONASI REKAP ===\n');
  console.log(await svc.getDonasiRekap());
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run (requires DB env): `DB_HOST=ep-sweet-hall-aony4lne-pooler.c-2.ap-southeast-1.aws.neon.tech DB_USER=neondb_owner DB_PASSWORD=npg_rhz6HYVkjq2D DB_NAME=neondb DB_PORT=5432 node -r ts-node/register /tmp/check-rekap.ts`

Expected output: pengkurban rekap menampilkan 3 CONFIRMED dengan ✅ (Asep, Margono, Andika); kambing/domba section menampilkan `Hadi Yuda (Domba - Tipe A)` dan `Harmansah (Kambing)`. Donasi rekap menampilkan 8 sohibul + 1 donor Fajar, plus footer dual phone + donate link.

(If build already produces dist/, use compiled JS imports instead of ts-node. Alternative: skip and verify via running dev server.)

- [ ] **Step 4: Commit (no-op: no code change, just noting milestone)**

No commit — this task is verification only.

---

## Task 10: Pricing reference card di `/dashboard.html`

**Files:**
- Modify: `client/dashboard.html`

No backend tests. Frontend: manual smoke.

- [ ] **Step 1: Add HTML section**

In `client/dashboard.html`, find the "Qurban & donation stats" grid (the second `<div class="grid ...">` ending around line ~90). **Immediately after that closing `</div>` (end of second grid)**, insert a new section:

```html
    <!-- Referensi Tarif Kurban & Infaq (bendahara quick-ref) -->
    <div class="glass-card p-4 mb-6" id="pricing-ref-card">
      <h3 class="text-lg font-semibold mb-3">💰 Referensi Tarif & Infaq</h3>
      <div class="text-xs text-white/60 mb-3">Untuk bendahara verifikasi transfer. Infaq operasional terpisah dari harga hewan.</div>
      <div id="pricing-ref-body" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="text-sm text-white/50">Loading...</div>
      </div>
    </div>
```

- [ ] **Step 2: Add JS to fetch + render**

In the `<script>` block at bottom of `dashboard.html`, after existing `loadStats()` / initialization code, add function + invocation:

```javascript
    async function loadPricingRef() {
      try {
        const res = await fetch('/api/public/pricing');
        const p = await res.json();
        const fmt = (n) => n.toLocaleString('id-ID');
        const body = document.getElementById('pricing-ref-body');

        const sapiHtml = `
          <div>
            <div class="font-semibold mb-1">🐄 Sapi Kolektif (${p.sapiKolektif.orangPerEkor} orang/ekor)</div>
            <table class="text-sm w-full">
              <tr><td>${p.sapiKolektif.opsiA.label} (${p.sapiKolektif.opsiA.beratSapi})</td><td class="text-right">Rp ${fmt(p.sapiKolektif.opsiA.perOrang)} + infaq ${fmt(p.sapiKolektif.opsiA.infaq)}</td></tr>
              <tr><td>${p.sapiKolektif.opsiB.label} (${p.sapiKolektif.opsiB.beratSapi})</td><td class="text-right">Rp ${fmt(p.sapiKolektif.opsiB.perOrang)} + infaq ${fmt(p.sapiKolektif.opsiB.infaq)}</td></tr>
            </table>
            <div class="mt-3 font-semibold mb-1">🐄 Sapi Perorangan</div>
            <div class="text-sm">${p.sapiPerorangan.note} + infaq ${fmt(p.sapiPerorangan.infaq)}</div>
          </div>
        `;

        const tierTable = (tiers, emoji, label) => `
          <div>
            <div class="font-semibold mb-1">${emoji} ${label}</div>
            <table class="text-sm w-full">
              ${tiers.map(t => {
                let priceCell;
                if (t.price != null) priceCell = `Rp ${fmt(t.price)}`;
                else if (t.priceMin != null) priceCell = `Rp ${fmt(t.priceMin)}-${fmt(t.priceMax)}`;
                else priceCell = t.priceNote || '-';
                return `<tr><td>${t.size} (${t.weight})</td><td class="text-right">${priceCell} + infaq ${fmt(t.infaq)}</td></tr>`;
              }).join('')}
            </table>
          </div>
        `;

        body.innerHTML = sapiHtml + tierTable(p.kambing, '🐐', 'Kambing') + tierTable(p.domba, '🐑', 'Domba');
      } catch (e) {
        document.getElementById('pricing-ref-body').innerHTML = '<div class="text-red-400 text-sm">Gagal load referensi harga</div>';
        console.error('[pricing-ref]', e);
      }
    }
    loadPricingRef();
```

- [ ] **Step 3: Smoke test (manual)**

Run backend locally: `npm run start:dev`
Open http://localhost:3000/dashboard.html, login. Verify pricing card renders with:
- Sapi Kolektif A + infaq, Sapi B + infaq
- Sapi Perorangan + infaq 1.75 jt
- Kambing 5 tier
- Domba 5 tier

- [ ] **Step 4: Commit**

```bash
git add client/dashboard.html
git commit -m "feat(dashboard): pricing reference card untuk bendahara"
```

---

## Task 11: "Perkiraan Total" column di `/pengkurban.html`

**Files:**
- Modify: `client/pengkurban.html`

- [ ] **Step 1: Tambah column header**

In `client/pengkurban.html`, update the `<thead>` (around line 52-64). Replace:

```html
            <tr>
              <th>No. Reg</th>
              <th>Nama Pendaftar</th>
              <th>Atas Nama Qurban</th>
              <th>Jenis Hewan</th>
              <th>Alamat</th>
              <th>Bukti</th>
              <th>Status</th>
              <th>Infaq</th>
              <th>Aksi</th>
            </tr>
```

With:

```html
            <tr>
              <th>No. Reg</th>
              <th>Nama Pendaftar</th>
              <th>Atas Nama Qurban</th>
              <th>Jenis Hewan</th>
              <th>Perkiraan Total</th>
              <th>Alamat</th>
              <th>Bukti</th>
              <th>Status</th>
              <th>Infaq</th>
              <th>Aksi</th>
            </tr>
```

Also update the `colspan="9"` in the loading row to `colspan="10"`.

- [ ] **Step 2: Fetch pricing on page load + build lookup helpers**

In the `<script>` block, near the top (after `const INFAQ = {...}` const), **delete the local `INFAQ` const** (lines 157-161), and add:

```javascript
    let PRICING = null;
    async function loadPricingCatalog() {
      try {
        const res = await fetch('/api/public/pricing');
        PRICING = await res.json();
      } catch (e) {
        console.error('[pricing-catalog]', e);
        PRICING = null;
      }
    }

    function getInfaq(animalType) {
      if (!PRICING) return 0;
      if (animalType === 'SAPI_PERORANGAN') return PRICING.sapiPerorangan.infaq;
      if (animalType === 'SAPI_KOLEKTIF_A') return PRICING.sapiKolektif.opsiA.infaq;
      if (animalType === 'SAPI_KOLEKTIF_B') return PRICING.sapiKolektif.opsiB.infaq;
      if (animalType === 'SAPI_KOLEKTIF') return PRICING.sapiKolektif.opsiA.infaq;
      if (animalType === 'KAMBING' || animalType === 'DOMBA') return PRICING.kambing[0].infaq;
      return 0;
    }

    function computeExpectedTotal(row) {
      if (!PRICING) return '(loading...)';
      const at = row.animalType;
      const infaq = getInfaq(at);
      const fmt = (n) => n.toLocaleString('id-ID');

      if (at === 'SAPI_KOLEKTIF_A') {
        return `Rp ${fmt(PRICING.sapiKolektif.opsiA.perOrang + infaq)} <span class="text-white/50 text-xs">(${fmt(PRICING.sapiKolektif.opsiA.perOrang)}+${fmt(infaq)})</span>`;
      }
      if (at === 'SAPI_KOLEKTIF_B') {
        return `Rp ${fmt(PRICING.sapiKolektif.opsiB.perOrang + infaq)} <span class="text-white/50 text-xs">(${fmt(PRICING.sapiKolektif.opsiB.perOrang)}+${fmt(infaq)})</span>`;
      }
      if (at === 'SAPI_PERORANGAN') {
        if (row.price == null) return '<span class="text-yellow-400">(harga belum diisi)</span>';
        const p = Number(row.price);
        return `Rp ${fmt(p + infaq)} <span class="text-white/50 text-xs">(${fmt(p)}+${fmt(infaq)})</span>`;
      }
      if (at === 'KAMBING' || at === 'DOMBA') {
        const catalog = at === 'KAMBING' ? PRICING.kambing : PRICING.domba;
        const tier = catalog.find(t => t.size === row.animalSize);
        if (!tier) return '<span class="text-yellow-400">(tier belum diisi)</span>';
        if (tier.price != null) {
          return `Rp ${fmt(tier.price + infaq)} <span class="text-white/50 text-xs">(${fmt(tier.price)}+${fmt(infaq)})</span>`;
        }
        if (tier.priceMin != null) {
          return `Rp ${fmt(tier.priceMin + infaq)}-${fmt(tier.priceMax + infaq)} <span class="text-white/50 text-xs">(range ${tier.size})</span>`;
        }
        return `<span class="text-white/70">${tier.priceNote || '-'}</span>`;
      }
      return '-';
    }
```

- [ ] **Step 3: Render column in each row**

Find `loadData()` function (around line 186). It builds `tr` rows inside `<tbody id="data-table">`. Inside the row-building `.map()` or loop, **after the `<td>` for "Jenis Hewan" and before the `<td>` for "Alamat"**, add one new `<td>`:

```javascript
          <td>${computeExpectedTotal(d)}</td>
```

(Exact insertion depends on the row template — open `loadData()` to confirm. The column order after edit must match thead: No.Reg, Nama Pendaftar, Atas Nama Qurban, Jenis Hewan, **Perkiraan Total**, Alamat, Bukti, Status, Infaq, Aksi.)

- [ ] **Step 4: Trigger pricing fetch before loadData**

Replace the init line `loadEventOptions('event-filter', true).then(() => loadData());` with:

```javascript
    Promise.all([loadPricingCatalog(), loadEventOptions('event-filter', true)])
      .then(() => loadData());
```

- [ ] **Step 5: Smoke test (manual)**

Run: `npm run start:dev`
Login, buka `/pengkurban.html`. Verify:
- Kolom baru "Perkiraan Total" muncul setelah "Jenis Hewan"
- Row Sapi Kolektif A → `Rp 4.300.000 (4.000.000+300.000)`
- Row Domba Tipe A (Hadi Yuda) → `Rp 3.250.000 (2.950.000+300.000)`
- Row Kambing tanpa size (Harmansah) → `(tier belum diisi)` kuning
- Row Sapi Perorangan tanpa price (Fajar) → `(harga belum diisi)` kuning

- [ ] **Step 6: Commit**

```bash
git add client/pengkurban.html
git commit -m "feat(pengkurban): kolom Perkiraan Total untuk bendahara"
```

---

## Task 12: Integration + PR

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: all pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (warnings OK).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/rekap-infaq-pricing
```

- [ ] **Step 5: Open PR to upstream**

```bash
gh pr create --repo ferisetiyawan/panitia-kurban --base master --head fajarmf:feat/rekap-infaq-pricing \
  --title "feat: rekap pakai infaq_paid + pricing reference dashboard" \
  --body "$(cat <<'EOF'
## Summary
- Rekap sumbangan: tampil semua non-REJECTED pengkurban + ✅ utk infaq_paid, donasi ✅ utk CONFIRMED, footer tambah donate link + nomor panitia
- Rekap pengkurban: ✅ pakai infaq_paid (konsisten dgn caption), kambing/domba tampil tier per row
- Dashboard: pricing reference card utk bendahara quick-ref tarif + infaq
- Pengkurban admin: kolom Perkiraan Total per row (harga + infaq, dihitung dari catalog)
- Refactor: extract pricing catalog + infaq ke `src/common/pricing.constants.ts` single-source-of-truth; `/api/public/pricing` response diperluas dgn field `infaq`

Spec: `docs/superpowers/specs/2026-04-24-rekap-and-pricing-reference-design.md`

## Test plan
- [x] Unit tests rekap.service.spec.ts (6 tests)
- [x] Unit tests public-pengkurban.controller.spec.ts (3 tests — infaq field)
- [x] Manual: generate rekap via admin UI, paste ke WA, verify format
- [x] Manual: `/dashboard.html` pricing card render
- [x] Manual: `/pengkurban.html` Perkiraan Total column akurat untuk semua row tipe hewan
EOF
)"
```

Record PR URL untuk nudge mas Feri via send-wa skill.

- [ ] **Step 6: Send WA nudge ke mas Feri**

(Manual step via send-wa skill — bukan bagian dari task file.)

---

## Self-review checklist

- [x] Spec coverage:
  - Part 1 (getDonasiRekap sohibul all+infaq_paid, donasi ✅, footer) → Tasks 4, 5, 6 ✓
  - Part 2 (getPengkurbanRekap ✅+tier) → Tasks 7, 8 ✓
  - Part 3 (dashboard pricing card) → Task 10 ✓
  - Part 4 (pengkurban expected-price column) → Task 11 ✓
  - Part 5 (pricing endpoint + shared constants) → Tasks 1, 2 ✓
- [x] No placeholders — each step has actual code/command
- [x] Type consistency — `infaqPaid` (entity field), `INFAQ_BY_ANIMAL` (constant) used consistently
- [x] File paths absolute where needed, relative for git commands (project root)
- [x] Commit messages in Indonesia casual style (match existing `git log` pattern)

---

## Execution notes

- All backend tasks use TDD (failing test → implement → pass).
- Frontend tasks skip automated tests (vanilla HTML, manual smoke).
- Each task ends with a commit — ~12 commits total, clean history for PR review.
- Running `npm run test` after each backend task is cheap (<10s), don't skip.
