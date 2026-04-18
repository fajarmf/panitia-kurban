import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ActivityLogsService } from './activity-logs.service';

@Controller('api/activity-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA)
  async findAll(@Query('limit') limit: string) {
    const limitNum = parseInt(limit, 10) || 50;
    return this.activityLogsService.findAll(limitNum);
  }
}
