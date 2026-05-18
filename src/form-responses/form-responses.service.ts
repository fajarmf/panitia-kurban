import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormResponse } from './form-response.entity';
import { Pengkurban } from '../pengkurban/pengkurban.entity';
import { SheetsClient } from './sheets-client';
import { parseReg, rowToData, parseTimestamp } from './mappers';

export interface SyncSummary {
  synced: number;
  skipped: Array<{ row?: string[]; reg?: string; reason: string }>;
  errors: Array<{ row: string[]; error: string }>;
}

@Injectable()
export class FormResponsesService {
  private readonly logger = new Logger(FormResponsesService.name);

  constructor(
    @InjectRepository(FormResponse)
    private readonly formRepo: Repository<FormResponse>,
    @InjectRepository(Pengkurban)
    private readonly pengkurbanRepo: Repository<Pengkurban>,
    private readonly sheets: SheetsClient,
  ) {}

  async syncFromSheet(
    formKey: string,
    sheetId: string,
    range: string,
  ): Promise<SyncSummary> {
    const summary: SyncSummary = {
      synced: 0,
      skipped: [],
      errors: [],
    };

    const rows = await this.sheets.readRange(sheetId, range);
    if (rows.length < 2) {
      return summary;
    }

    const headers = rows[0];
    const responseRows = rows.slice(1);

    for (const row of responseRows) {
      try {
        const data = rowToData(headers, row);
        const namaCell = data['Nama Sohibul Qurban'];
        const reg = parseReg(namaCell);

        if (!reg) {
          summary.skipped.push({ row, reason: 'no REG in Nama' });
          continue;
        }

        const pengkurban = await this.pengkurbanRepo.findOne({
          where: { registrationNumber: reg },
        });
        if (!pengkurban) {
          summary.skipped.push({ reg, reason: 'pengkurban not found' });
          continue;
        }

        const formSubmittedAt = parseTimestamp(data['Timestamp']);
        const payload = {
          pengkurbanId: pengkurban.id,
          formKey,
          data,
          formSubmittedAt,
        };

        await this.formRepo.upsert(payload, {
          conflictPaths: ['pengkurbanId', 'formKey'],
        });
        summary.synced++;
      } catch (e) {
        const err = e as Error;
        console.error('[form-responses sync]', err.stack || err.message);
        summary.errors.push({ row, error: err.message });
      }
    }

    this.logger.log(
      `Sync ${formKey}: synced=${summary.synced} skipped=${summary.skipped.length} errors=${summary.errors.length}`,
    );
    return summary;
  }
}
