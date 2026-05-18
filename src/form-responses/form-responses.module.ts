import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormResponse } from './form-response.entity';
import { SheetsClient } from './sheets-client';
import { FormResponsesService } from './form-responses.service';
import { SyncCronService } from './sync-cron.service';
import { Pengkurban } from '../pengkurban/pengkurban.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormResponse, Pengkurban])],
  providers: [SheetsClient, FormResponsesService, SyncCronService],
  exports: [FormResponsesService],
})
export class FormResponsesModule {}
