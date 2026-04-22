import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RekapService } from './rekap.service';

@Controller('api/rekap')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RekapController {
  constructor(private rekapService: RekapService) {}

  @Get('pengkurban')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  async pengkurban(@Query('eventId') eventId?: string) {
    const text = await this.rekapService.getPengkurbanRekap(eventId);
    return { text };
  }

  @Get('donasi')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  async donasi(@Query('eventId') eventId?: string) {
    const text = await this.rekapService.getDonasiRekap(eventId);
    return { text };
  }
}
