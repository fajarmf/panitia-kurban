import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { DonationsService } from './donations.service';
import { VerifyDonationDto } from './dto/verify-donation.dto';
import { DonationStatus } from '../common/enums/donation-status.enum';

@Controller('api/donations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DonationsController {
  constructor(private donationsService: DonationsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  findAll(
    @Query('eventId') eventId?: string,
    @Query('status') status?: DonationStatus,
  ) {
    return this.donationsService.findAll(eventId, status);
  }

  @Get('export')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  async exportCsv(
    @Query('eventId') eventId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.donationsService.exportCsv(eventId);
    res.header('Content-Type', 'text/csv');
    res.attachment('donations.csv');
    return res.send(csv);
  }

  @Get('total')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  getTotal(@Query('eventId') eventId?: string) {
    return this.donationsService.getTotal(eventId);
  }

  @Patch(':id/verify')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA)
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDonationDto,
  ) {
    return this.donationsService.verify(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.donationsService.remove(id);
  }
}
