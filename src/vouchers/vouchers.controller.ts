import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { VouchersService } from './vouchers.service';

@Controller('api/vouchers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class VouchersController {
  constructor(private vouchersService: VouchersService) {}

  @Get()
  findAll(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.vouchersService.findAll(eventId, status, search);
  }

  @Get('stats')
  stats(@Query('eventId') eventId?: string) {
    return this.vouchersService.stats(eventId);
  }

  @Get('scan-logs')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA)
  scanLogs(@Query('eventId') eventId?: string) {
    return this.vouchersService.getScanLogs(eventId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vouchersService.findById(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.vouchersService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=voucher-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  create(
    @Body() body: { eventId: string; distributionDate: string },
    @Request() req: any,
  ) {
    return this.vouchersService.create(body.eventId, body.distributionDate, req.user.id);
  }

  @Post('batch')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  createBatch(
    @Body() body: { eventId: string; count: number; distributionDate: string },
    @Request() req: any,
  ) {
    return this.vouchersService.createBatch(body.eventId, body.count, body.distributionDate, req.user.id);
  }

  @Post('scan')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_SCANNER)
  scan(@Body() body: { voucherCode: string }, @Request() req: any) {
    return this.vouchersService.scan(body.voucherCode, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  remove(@Param('id') id: string) {
    return this.vouchersService.remove(id);
  }
}
