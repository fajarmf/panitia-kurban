import { IsString, IsEnum, IsOptional, IsNumber, Matches } from 'class-validator';
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
  @Matches(/^(08[0-9]{8,11}|\+[1-9][0-9]{9,14})$/, {
    message: 'Nomor HP tidak valid. Gunakan format 08... (10-13 digit) atau +<kode negara>...',
  })
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
