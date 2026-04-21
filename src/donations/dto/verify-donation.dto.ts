import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DonationStatus } from '../../common/enums/donation-status.enum';

const ALLOWED_STATUSES = [
  DonationStatus.CONFIRMED,
  DonationStatus.REJECTED,
] as const;

export class VerifyDonationDto {
  @IsEnum(ALLOWED_STATUSES)
  status: DonationStatus.CONFIRMED | DonationStatus.REJECTED;

  @IsOptional()
  @IsString()
  notes?: string;
}
