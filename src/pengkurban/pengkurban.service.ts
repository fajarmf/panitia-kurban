import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Pengkurban } from './pengkurban.entity';
import { Event } from '../events/event.entity';
import { CreatePengkurbanDto, UpdatePengkurbanDto } from './dto/pengkurban.dto';
import { PublicRegisterDto } from './dto/public-register.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { WaNotifierService } from '../common/notifications/wa-notifier.service';
import { getInfaqAmount } from '../common/constants/infaq';

@Injectable()
export class PengkurbanService {
  constructor(
    @InjectRepository(Pengkurban)
    private pengkurbanRepository: Repository<Pengkurban>,
    private waNotifier: WaNotifierService,
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
    const header = [
      'No. Registrasi',
      'Nama Pendaftar',
      'Atas Nama Qurban',
      'Alamat',
      'Jenis Hewan',
      'Ukuran Hewan',
      'Tipe Akad',
      'Harga',
      'Infaq Operasional',
      'Status Infaq',
      'Tgl Infaq Lunas',
      'Status',
      'Telepon',
      'Catatan',
      'Event',
      'Tahun',
    ].join(',');
    const rows = data.map((d) => {
      const infaqAmount = getInfaqAmount(d.animalType);
      return [
        d.registrationNumber,
        d.name,
        d.shohibulName || '',
        d.address,
        d.animalType,
        d.animalSize || '',
        d.purchaseType,
        d.price != null ? String(d.price) : '',
        String(infaqAmount),
        d.infaqPaid ? 'Lunas' : 'Belum',
        d.infaqPaidAt ? d.infaqPaidAt.toISOString() : '',
        d.status,
        d.phone || '',
        d.notes || '',
        d.event?.name || '',
        d.event?.year || '',
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(',');
    });
    return [header, ...rows].join('\n');
  }

  async markInfaqPaid(id: string, paid: boolean): Promise<Pengkurban> {
    const pk = await this.findById(id);
    pk.infaqPaid = paid;
    pk.infaqPaidAt = paid ? new Date() : null;
    return this.pengkurbanRepository.save(pk);
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
    const registrationNumber = await this.generateRegistrationNumber(
      dto.eventId,
    );
    const pk = this.pengkurbanRepository.create({
      ...dto,
      registrationNumber,
      status: dto.status ?? RegistrationStatus.CONFIRMED,
    });
    return this.pengkurbanRepository.save(pk);
  }

  async update(id: string, dto: UpdatePengkurbanDto): Promise<Pengkurban> {
    const pk = await this.findById(id);
    Object.assign(pk, dto);
    return this.pengkurbanRepository.save(pk);
  }

  async remove(id: string): Promise<void> {
    const pk = await this.findById(id);
    await this.pengkurbanRepository.softRemove(pk);
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

  async registerPublic(dto: PublicRegisterDto): Promise<{
    id: string;
    registrationNumber: string;
    status: RegistrationStatus;
  }> {
    let eventId = dto.eventId;

    if (!eventId) {
      const activeEvent = await this.pengkurbanRepository.manager
        .getRepository(Event)
        .findOne({ where: { isActive: true }, order: { createdAt: 'DESC' } });
      if (!activeEvent) {
        throw new BadRequestException('Tidak ada event aktif saat ini');
      }
      eventId = activeEvent.id;
    }

    const registrationNumber = await this.generateRegistrationNumber(eventId);
    const pk = this.pengkurbanRepository.create({
      ...dto,
      eventId,
      registrationNumber,
      status: RegistrationStatus.PENDING_PAYMENT,
    });
    const saved = await this.pengkurbanRepository.save(pk);

    this.waNotifier.send(
      `🐄 *Pengkurban baru*\n` +
        `${saved.registrationNumber} — ${saved.name}\n` +
        `Hewan: ${saved.animalType}${saved.animalSize ? ' ' + saved.animalSize : ''}\n` +
        `Akad: ${saved.purchaseType}\n` +
        (saved.phone ? `HP: ${saved.phone}\n` : '') +
        `Status: ${saved.status}`,
    );

    return {
      id: saved.id,
      registrationNumber: saved.registrationNumber,
      status: saved.status,
    };
  }

  async attachPaymentProof(
    id: string,
    file: Express.Multer.File,
  ): Promise<{
    id: string;
    status: RegistrationStatus;
    paymentProofPaths: string[];
  }> {
    const pk = await this.findById(id);

    const uploadDir = path.join(process.cwd(), 'uploads', 'payment-proofs');
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `${pk.registrationNumber}-${timestamp}${ext}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    const existing = pk.paymentProofPaths || [];
    pk.paymentProofPaths = [...existing, `uploads/payment-proofs/${filename}`];
    if (pk.status === RegistrationStatus.PENDING_PAYMENT) {
      pk.status = RegistrationStatus.PENDING_VERIFICATION;
    }
    await this.pengkurbanRepository.save(pk);

    return {
      id: pk.id,
      status: pk.status,
      paymentProofPaths: pk.paymentProofPaths,
    };
  }

  async verify(id: string, dto: VerifyRegistrationDto): Promise<Pengkurban> {
    const pk = await this.findById(id);
    pk.status = dto.status;
    if (dto.notes) {
      pk.notes = pk.notes
        ? `${pk.notes}\n[Verifikasi] ${dto.notes}`
        : `[Verifikasi] ${dto.notes}`;
    }
    return this.pengkurbanRepository.save(pk);
  }

  async findPublicStatus(id: string): Promise<{
    id: string;
    registrationNumber: string;
    name: string;
    shohibulName: string | null;
    animalType: string;
    animalSize: string | null;
    status: RegistrationStatus;
    createdAt: Date;
  }> {
    const pk = await this.findById(id);
    return {
      id: pk.id,
      registrationNumber: pk.registrationNumber,
      name: pk.name,
      shohibulName: pk.shohibulName,
      animalType: pk.animalType,
      animalSize: pk.animalSize,
      status: pk.status,
      createdAt: pk.createdAt,
    };
  }

  async findByPhone(phone: string): Promise<
    {
      id: string;
      registrationNumber: string;
      name: string;
      animalType: string;
      status: RegistrationStatus;
      createdAt: Date;
    }[]
  > {
    const digits = phone.replace(/\D/g, '');
    // match 081234... or +62/62 prefix variants
    const variants = Array.from(
      new Set([
        digits,
        digits.startsWith('0') ? `62${digits.slice(1)}` : digits,
        digits.startsWith('62') ? `0${digits.slice(2)}` : digits,
      ]),
    );
    const results = await this.pengkurbanRepository.find({
      where: variants.map((p) => ({ phone: p })),
      order: { createdAt: 'DESC' },
    });
    return results.map((pk) => ({
      id: pk.id,
      registrationNumber: pk.registrationNumber,
      name: pk.name,
      animalType: pk.animalType,
      status: pk.status,
      createdAt: pk.createdAt,
    }));
  }

  async generateRegistrationNumber(eventId: string): Promise<string> {
    const event = await this.pengkurbanRepository.manager
      .getRepository(Event)
      .findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event tidak ditemukan');

    const row = await this.pengkurbanRepository
      .createQueryBuilder('pk')
      .withDeleted()
      .select(
        "MAX(CAST(SUBSTRING(pk.registration_number FROM '(\\d+)$') AS INTEGER))",
        'max',
      )
      .where('pk.event_id = :eventId', { eventId })
      .getRawOne<{ max: number | null }>();

    const next = (row?.max ?? 0) + 1;
    const seq = String(next).padStart(4, '0');
    return `REG-${event.year}-${seq}`;
  }
}
