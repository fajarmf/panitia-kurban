import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pengkurban } from '../pengkurban/pengkurban.entity';
import { Donation } from '../donations/donation.entity';
import { RekapService } from './rekap.service';
import { RekapController } from './rekap.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pengkurban, Donation])],
  providers: [RekapService],
  controllers: [RekapController],
  exports: [RekapService],
})
export class RekapModule {}
