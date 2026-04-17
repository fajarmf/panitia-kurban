import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pengkurban } from './pengkurban.entity';
import { CreatePengkurbanDto, UpdatePengkurbanDto } from './dto/pengkurban.dto';

@Injectable()
export class PengkurbanService {
  constructor(
    @InjectRepository(Pengkurban)
    private pengkurbanRepository: Repository<Pengkurban>,
  ) {}

  async findAll(eventId?: string): Promise<Pengkurban[]> {
    const where: any = {};
    if (eventId) where.eventId = eventId;
    return this.pengkurbanRepository.find({
      where,
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }

  async exportCsv(eventId?: string): Promise<string> {
    const data = await this.findAll(eventId);
    const header = ['Nama', 'Jenis Hewan', 'Tipe Akad', 'Telepon', 'Catatan', 'Event', 'Tahun'].join(',');
    const rows = data.map(d => {
      return [
        d.name,
        d.animalType,
        d.purchaseType,
        d.phone || '',
        d.notes || '',
        d.event?.name || '',
        d.event?.year || '',
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    return [header, ...rows].join('\n');
  }

  async findById(id: string): Promise<Pengkurban> {
    const pk = await this.pengkurbanRepository.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!pk) throw new NotFoundException('Pengkurban tidak ditemukan');
    return pk;
  }

  async create(dto: CreatePengkurbanDto): Promise<Pengkurban> {
    const pk = this.pengkurbanRepository.create(dto);
    return this.pengkurbanRepository.save(pk);
  }

  async update(id: string, dto: UpdatePengkurbanDto): Promise<Pengkurban> {
    const pk = await this.findById(id);
    Object.assign(pk, dto);
    return this.pengkurbanRepository.save(pk);
  }

  async remove(id: string): Promise<void> {
    const pk = await this.findById(id);
    await this.pengkurbanRepository.remove(pk);
  }

  async countByEvent(eventId: string): Promise<number> {
    return this.pengkurbanRepository.count({ where: { eventId } });
  }

  async statsByEvent(eventId: string) {
    const data = await this.pengkurbanRepository
      .createQueryBuilder('p')
      .select('p.animal_type', 'animalType')
      .addSelect('p.purchase_type', 'purchaseType')
      .addSelect('COUNT(*)', 'count')
      .where('p.event_id = :eventId', { eventId })
      .groupBy('p.animal_type')
      .addGroupBy('p.purchase_type')
      .getRawMany();
    return data;
  }
}
