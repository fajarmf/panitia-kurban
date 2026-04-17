import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Voucher } from './voucher.entity';
import { ScanLog } from './scan-log.entity';
import { Event } from '../events/event.entity';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, ScanLog, Event])],
  providers: [VouchersService],
  controllers: [VouchersController],
  exports: [VouchersService],
})
export class VouchersModule {}
