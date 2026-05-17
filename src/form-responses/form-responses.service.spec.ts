import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormResponsesService } from './form-responses.service';
import { FormResponse } from './form-response.entity';
import { Pengkurban } from '../pengkurban/pengkurban.entity';
import { SheetsClient } from './sheets-client';

describe('FormResponsesService.syncFromSheet', () => {
  let service: FormResponsesService;
  let sheets: jest.Mocked<SheetsClient>;
  let formRepo: jest.Mocked<Repository<FormResponse>>;
  let pengkurbanRepo: jest.Mocked<Repository<Pengkurban>>;

  const formKey = 'konfirmasi_teknis_1447h'; // gitleaks:allow
  const sheetId = 'sheetId_TEST';
  const range = 'Form Responses 1!A:Z';

  beforeEach(async () => {
    const sheetsMock = { readRange: jest.fn() };
    const formRepoMock = {
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    const pengkurbanRepoMock = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormResponsesService,
        { provide: SheetsClient, useValue: sheetsMock },
        { provide: getRepositoryToken(FormResponse), useValue: formRepoMock },
        { provide: getRepositoryToken(Pengkurban), useValue: pengkurbanRepoMock },
      ],
    }).compile();

    service = module.get<FormResponsesService>(FormResponsesService);
    sheets = module.get(SheetsClient) as jest.Mocked<SheetsClient>;
    formRepo = module.get(getRepositoryToken(FormResponse)) as jest.Mocked<
      Repository<FormResponse>
    >;
    pengkurbanRepo = module.get(getRepositoryToken(Pengkurban)) as jest.Mocked<
      Repository<Pengkurban>
    >;
  });

  it('inserts new row when pengkurban exists and no prior response', async () => {
    sheets.readRange.mockResolvedValue([
      ['Timestamp', 'Nama Sohibul Qurban', 'Pilihan'],
      ['2026-05-19 14:23:45', 'Sohibul Test (REG-2026-0001)', '1/3 (sepertiga)'],
    ]);
    pengkurbanRepo.findOne.mockResolvedValue({ id: 'uuid-1' } as Pengkurban);
    formRepo.findOne.mockResolvedValue(null);
    formRepo.insert.mockResolvedValue({} as any);

    const summary = await service.syncFromSheet(formKey, sheetId, range);

    expect(summary.inserted).toBe(1);
    expect(summary.updated).toBe(0);
    expect(formRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pengkurbanId: 'uuid-1',
        formKey: formKey,
        data: expect.objectContaining({
          Timestamp: '2026-05-19 14:23:45',
          'Nama Sohibul Qurban': 'Sohibul Test (REG-2026-0001)',
          Pilihan: '1/3 (sepertiga)',
        }),
      }),
    );
  });

  it('updates existing row when prior response exists', async () => {
    sheets.readRange.mockResolvedValue([
      ['Timestamp', 'Nama Sohibul Qurban'],
      ['2026-05-19 14:23:45', 'Sohibul Test (REG-2026-0001)'],
    ]);
    pengkurbanRepo.findOne.mockResolvedValue({ id: 'uuid-1' } as Pengkurban);
    formRepo.findOne.mockResolvedValue({ id: 'existing-uuid' } as FormResponse);
    formRepo.update.mockResolvedValue({} as any);

    const summary = await service.syncFromSheet(formKey, sheetId, range);

    expect(summary.updated).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(formRepo.update).toHaveBeenCalledWith('existing-uuid', expect.any(Object));
  });

  it('skips row when no REG in Nama Sohibul Qurban', async () => {
    sheets.readRange.mockResolvedValue([
      ['Timestamp', 'Nama Sohibul Qurban'],
      ['2026-05-19 14:23:45', 'Sohibul Anonim'],
    ]);

    const summary = await service.syncFromSheet(formKey, sheetId, range);

    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped[0]).toMatchObject({ reason: expect.stringMatching(/REG/i) });
    expect(pengkurbanRepo.findOne).not.toHaveBeenCalled();
  });

  it('skips row when pengkurban not found in DB', async () => {
    sheets.readRange.mockResolvedValue([
      ['Timestamp', 'Nama Sohibul Qurban'],
      ['2026-05-19 14:23:45', 'Sohibul Test (REG-2026-9999)'],
    ]);
    pengkurbanRepo.findOne.mockResolvedValue(null);

    const summary = await service.syncFromSheet(formKey, sheetId, range);

    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped[0]).toMatchObject({
      reg: 'REG-2026-9999',
      reason: expect.stringMatching(/not found/i),
    });
  });

  it('returns empty summary when sheet only has header row', async () => {
    sheets.readRange.mockResolvedValue([['Timestamp', 'Nama Sohibul Qurban']]);

    const summary = await service.syncFromSheet(formKey, sheetId, range);

    expect(summary).toEqual({ inserted: 0, updated: 0, skipped: [], errors: [] });
  });

  it('records error per row when mapping throws (e.g., invalid timestamp)', async () => {
    sheets.readRange.mockResolvedValue([
      ['Timestamp', 'Nama Sohibul Qurban'],
      ['not-a-date', 'Sohibul Test (REG-2026-0001)'],
    ]);
    pengkurbanRepo.findOne.mockResolvedValue({ id: 'uuid-1' } as Pengkurban);

    const summary = await service.syncFromSheet(formKey, sheetId, range);

    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].error).toMatch(/invalid/i);
    expect(summary.inserted).toBe(0);
  });
});
