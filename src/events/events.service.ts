import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
  ) {}

  async findAll(): Promise<Event[]> {
    return this.eventsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event tidak ditemukan');
    return event;
  }

  async findActive(): Promise<Event | null> {
    return this.eventsRepository.findOne({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async create(data: Partial<Event>): Promise<Event> {
    const event = this.eventsRepository.create(data);
    return this.eventsRepository.save(event);
  }

  async update(id: string, data: Partial<Event>): Promise<Event> {
    const event = await this.findById(id);
    Object.assign(event, data);
    return this.eventsRepository.save(event);
  }

  async uploadLogo(id: string, file: Express.Multer.File): Promise<Event> {
    const event = await this.findById(id);
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const dir = path.join(uploadDir, 'logos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `logo-${id}-${Date.now()}${path.extname(file.originalname)}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, file.buffer);
    event.logoPath = `/api/uploads/logos/${filename}`;
    return this.eventsRepository.save(event);
  }

  async delete(id: string): Promise<void> {
    const event = await this.findById(id);
    await this.eventsRepository.remove(event);
  }
}
