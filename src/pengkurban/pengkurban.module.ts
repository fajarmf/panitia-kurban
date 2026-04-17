import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pengkurban } from './pengkurban.entity';
import { PengkurbanService } from './pengkurban.service';
import { PengkurbanController } from './pengkurban.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pengkurban])],
  providers: [PengkurbanService],
  controllers: [PengkurbanController],
  exports: [PengkurbanService],
})
export class PengkurbanModule {}
