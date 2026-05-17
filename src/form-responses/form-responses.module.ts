import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormResponse } from './form-response.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormResponse])],
})
export class FormResponsesModule {}
