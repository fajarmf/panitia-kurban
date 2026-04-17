import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Voucher } from '../vouchers/voucher.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { Pengkurban } from '../pengkurban/pengkurban.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, Event, User, Pengkurban])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
