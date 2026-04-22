import { Global, Module } from '@nestjs/common';
import { WaNotifierService } from './wa-notifier.service';

@Global()
@Module({
  providers: [WaNotifierService],
  exports: [WaNotifierService],
})
export class NotificationsModule {}
