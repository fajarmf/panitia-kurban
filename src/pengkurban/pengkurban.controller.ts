import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PengkurbanService } from './pengkurban.service';
import { CreatePengkurbanDto, UpdatePengkurbanDto } from './dto/pengkurban.dto';

@Controller('api/pengkurban')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PengkurbanController {
  constructor(private pengkurbanService: PengkurbanService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  findAll(@Query('eventId') eventId?: string) {
    return this.pengkurbanService.findAll(eventId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  findOne(@Param('id') id: string) {
    return this.pengkurbanService.findById(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  create(@Body() dto: CreatePengkurbanDto) {
    return this.pengkurbanService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  update(@Param('id') id: string, @Body() dto: UpdatePengkurbanDto) {
    return this.pengkurbanService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.KETUA_PANITIA, Role.PANITIA_VOUCHER)
  remove(@Param('id') id: string) {
    return this.pengkurbanService.remove(id);
  }
}
