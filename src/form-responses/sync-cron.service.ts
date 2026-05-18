import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FormResponsesService } from './form-responses.service';

@Injectable()
export class SyncCronService {
  private readonly logger = new Logger(SyncCronService.name);

  constructor(private readonly service: FormResponsesService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncKonfirmasiTeknis() {
    const formKey = process.env.KONFIRMASI_TEKNIS_FORM_KEY;
    const sheetId = process.env.KONFIRMASI_TEKNIS_SHEET_ID;
    const range = process.env.KONFIRMASI_TEKNIS_RANGE;

    if (!formKey || !sheetId || !range) {
      this.logger.warn('Konfirmasi teknis env vars missing — skip cron tick');
      return;
    }

    try {
      await this.service.syncFromSheet(formKey, sheetId, range);
    } catch (e) {
      const err = e as Error;
      console.error('[sync-cron konfirmasi-teknis]', err.stack || err.message);
    }
  }
}
