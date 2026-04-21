import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AnimalType } from '../../common/enums/animal-type.enum';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { RegistrationStatus } from '../../common/enums/registration-status.enum';

export class CreatePengkurbanDto {
  @IsString()
  eventId: string;

  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsEnum(AnimalType)
  animalType: AnimalType;

  @IsEnum(PurchaseType)
  purchaseType: PurchaseType;

  @IsOptional()
  @IsString()
  animalSize?: string;

  @IsOptional()
  @IsString()
  shohibulName?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;
}

export class UpdatePengkurbanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(AnimalType)
  animalType?: AnimalType;

  @IsOptional()
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;

  @IsOptional()
  @IsString()
  animalSize?: string;

  @IsOptional()
  @IsString()
  shohibulName?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;
}
