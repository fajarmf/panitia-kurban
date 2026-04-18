import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './activity-log.entity';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogsRepository: Repository<ActivityLog>,
  ) {}

  async logAction(data: { userId?: string; action: string; details?: string }) {
    try {
      const log = this.activityLogsRepository.create(data);
      await this.activityLogsRepository.save(log);
    } catch (err) {
      console.error('Failed to save activity log:', err);
    }
  }

  async findAll(limit: number = 50) {
    return this.activityLogsRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }
}
