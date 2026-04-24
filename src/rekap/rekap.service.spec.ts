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
});
