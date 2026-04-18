import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { Voucher } from '../vouchers/voucher.entity';
import { ScanLog } from '../vouchers/scan-log.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Voucher, ScanLog])],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
