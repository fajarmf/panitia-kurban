import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormResponse } from './form-response.entity';
import { SheetsClient } from './sheets-client';

@Module({
  imports: [TypeOrmModule.forFeature([FormResponse])],
  providers: [SheetsClient],
  exports: [SheetsClient],
})
export class FormResponsesModule {}
