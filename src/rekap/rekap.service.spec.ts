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
