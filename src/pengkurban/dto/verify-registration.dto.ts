import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RegistrationStatus } from '../../common/enums/registration-status.enum';

const ALLOWED_STATUSES = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.REJECTED,
] as const;

export class VerifyRegistrationDto {
  @IsEnum(ALLOWED_STATUSES)
  status: RegistrationStatus.CONFIRMED | RegistrationStatus.REJECTED;

  @IsOptional()
  @IsString()
  notes?: string;
}
