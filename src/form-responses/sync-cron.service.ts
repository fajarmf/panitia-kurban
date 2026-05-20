import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FormResponsesService } from './form-responses.service';

@Injectable()
export class SyncCronService {
  private readonly logger = new Logger(SyncCronService.name);

  constructor(private readonly service: FormResponsesService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncKonfirmasiTeknis() {
    // PM2 cluster mode: only worker 0 runs cron to avoid duplicate Sheets reads.
    // NODE_APP_INSTANCE is set by PM2 per worker (0..N-1). Unset = single-instance, run normally.
    if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== '0') {
      return;
    }

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
