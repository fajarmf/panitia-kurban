import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WaNotifierService {
  private readonly logger = new Logger(WaNotifierService.name);
  private readonly baseUrl = process.env.WA_BOT_URL;
  private readonly apiKey = process.env.WA_BOT_API_KEY;
  private readonly targetPhone = process.env.WA_NOTIFY_PHONE;

  send(message: string): void {
    if (!this.baseUrl || !this.apiKey || !this.targetPhone) {
      this.logger.warn('WA notifier not configured, skipping');
      return;
    }
    fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ to: this.targetPhone, message }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          this.logger.error(`WA send failed ${res.status}: ${text}`);
        }
      })
      .catch((e) => this.logger.error(`WA send error: ${e.message}`));
  }
}
