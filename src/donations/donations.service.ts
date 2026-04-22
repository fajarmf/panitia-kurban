import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Donation } from './donation.entity';
import { Event } from '../events/event.entity';
import { CreateDonationDto } from './dto/create-donation.dto';
import { VerifyDonationDto } from './dto/verify-donation.dto';
import { DonationStatus } from '../common/enums/donation-status.enum';
import { WaNotifierService } from '../common/notifications/wa-notifier.service';

@Injectable()
export class DonationsService {
  constructor(
    @InjectRepository(Donation)
    private donationRepository: Repository<Donation>,
    private waNotifier: WaNotifierService,
  ) {}

  async submitPublic(
    dto: CreateDonationDto,
    file?: Express.Multer.File,
  ): Promise<{ id: string; status: DonationStatus }> {
    let eventId: string | undefined = dto.eventId;

    if (!eventId) {
      const activeEvent = await this.donationRepository.manager
        .getRepository(Event)
        .findOne({ where: { isActive: true }, order: { createdAt: 'DESC' } });
      if (activeEvent) {
        eventId = activeEvent.id;
      }
    }

    const donation = this.donationRepository.create({
      ...dto,
      eventId: eventId,
      status: DonationStatus.PENDING_VERIFICATION,
    });

    let saved = await this.donationRepository.save(donation);

    if (file) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'donation-proofs');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const filename = `${saved.id}-${timestamp}${ext}`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, file.buffer);
      saved.paymentProofPaths = [`uploads/donation-proofs/${filename}`];
      saved = await this.donationRepository.save(saved);
    }

    const amountStr =
      saved.amount != null
        ? `Rp ${Number(saved.amount).toLocaleString('id-ID')}`
        : '(tidak disebutkan)';
    this.waNotifier.send(
      `💰 *Donasi baru*\n` +
        `${saved.name}\n` +
        `Jumlah: ${amountStr}\n` +
        (saved.phone ? `HP: ${saved.phone}\n` : '') +
        `Status: ${saved.status}` +
        (file ? '\n(+ bukti transfer terlampir)' : ''),
    );

    return {
      id: saved.id,
      status: saved.status,
    };
  }

  async findPublicStatus(id: string): Promise<{
    id: string;
    name: string;
    amount: number | null;
    status: DonationStatus;
    createdAt: Date;
  }> {
    const donation = await this.donationRepository.findOne({ where: { id } });
    if (!donation) throw new NotFoundException('Donasi tidak ditemukan');
    return {
      id: donation.id,
      name: donation.name,
      amount: donation.amount,
      status: donation.status,
      createdAt: donation.createdAt,
    };
  }

  async findAll(
    eventId?: string,
    status?: DonationStatus,
  ): Promise<Donation[]> {
    const where: FindOptionsWhere<Donation> = {};
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;
    return this.donationRepository.find({
      where,
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }

  async verify(id: string, dto: VerifyDonationDto): Promise<Donation> {
    const donation = await this.donationRepository.findOne({ where: { id } });
    if (!donation) throw new NotFoundException('Donasi tidak ditemukan');
    donation.status = dto.status;
    if (dto.notes) {
      donation.notes = donation.notes
        ? `${donation.notes}\n[Verifikasi] ${dto.notes}`
        : `[Verifikasi] ${dto.notes}`;
    }
    return this.donationRepository.save(donation);
  }

  async remove(id: string): Promise<void> {
    const donation = await this.donationRepository.findOne({ where: { id } });
    if (!donation) throw new NotFoundException('Donasi tidak ditemukan');
    await this.donationRepository.softRemove(donation);
  }

  async exportCsv(eventId?: string): Promise<string> {
    const data = await this.findAll(eventId);
    const header = [
      'ID',
      'Nama',
      'Alamat',
      'Telepon',
      'Jumlah',
      'Status',
      'Catatan',
      'Event',
      'Tanggal',
    ].join(',');
    const rows = data.map((d) =>
      [
        d.id,
        d.name,
        d.address || '',
        d.phone || '',
        d.amount != null ? String(d.amount) : '',
        d.status,
        d.notes || '',
        d.event?.name || '',
        d.createdAt.toISOString(),
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  async getTotal(eventId?: string): Promise<{ total: number; count: number }> {
    const qb = this.donationRepository
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('d.status = :status', { status: DonationStatus.CONFIRMED });
    if (eventId) {
      qb.andWhere('d.event_id = :eventId', { eventId });
    }
    const result = await qb.getRawOne<{ total: string; count: string }>();
    return {
      total: Number(result?.total ?? 0),
      count: Number(result?.count ?? 0),
    };
  }
}
