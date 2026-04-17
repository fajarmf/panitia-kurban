import { Test, TestingModule } from '@nestjs/testing';
import { VouchersService } from './vouchers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Voucher } from './voucher.entity';
import { ScanLog } from './scan-log.entity';
import { Event } from '../events/event.entity';
import { VouchersGateway } from './vouchers.gateway';

describe('VouchersService', () => {
  let service: VouchersService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockGateway = {
    notifyVoucherClaimed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        { provide: getRepositoryToken(Voucher), useValue: mockRepository },
        { provide: getRepositoryToken(ScanLog), useValue: mockRepository },
        { provide: getRepositoryToken(Event), useValue: mockRepository },
        { provide: VouchersGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
