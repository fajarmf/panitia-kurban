import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormResponse } from './form-response.entity';
import { SheetsClient } from './sheets-client';
import { FormResponsesService } from './form-responses.service';
import { Pengkurban } from '../pengkurban/pengkurban.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormResponse, Pengkurban])],
  providers: [SheetsClient, FormResponsesService],
  exports: [FormResponsesService],
})
export class FormResponsesModule {}
