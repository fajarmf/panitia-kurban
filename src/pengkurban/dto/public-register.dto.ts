import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AnimalType } from '../../common/enums/animal-type.enum';
import { PurchaseType } from '../../common/enums/purchase-type.enum';

export class PublicRegisterDto {
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
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  eventId?: string;
}
