import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private usersService: UsersService) {}

  async onModuleInit() {
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const existing = await this.usersService.findByUsername('admin');
    if (!existing) {
      await this.usersService.create({
        username: 'admin',
        password: 'admin123',
        fullName: 'Super Administrator',
        role: Role.SUPER_ADMIN,
      });
      this.logger.log('✅ Default Super Admin created (admin / admin123)');
    } else {
      this.logger.log('ℹ️  Super Admin already exists, skipping seed');
    }
  }
}
