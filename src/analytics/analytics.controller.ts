import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AnalyticsService } from './analytics.service';

class TrackDto {
  page: string;
  sessionId: string;
  referrer?: string;
}

@Controller('api/public/track')
export class PublicTrackController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post()
  async track(@Body() dto: TrackDto) {
    if (!dto.page || !dto.sessionId) return;
    await this.analyticsService.track(dto.page, dto.sessionId, dto.referrer);
  }
}

@Controller('api/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA)
  getStats() {
    return this.analyticsService.getStats();
  }
}
