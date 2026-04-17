import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { Voucher } from './voucher.entity';
import { ScanLog } from './scan-log.entity';
import { Event } from '../events/event.entity';
import { VoucherStatus } from '../common/enums/voucher-status.enum';
import { VouchersGateway } from './vouchers.gateway';

@Injectable()
export class VouchersService {
  constructor(
    @InjectRepository(Voucher)
    private vouchersRepository: Repository<Voucher>,
    @InjectRepository(ScanLog)
    private scanLogsRepository: Repository<ScanLog>,
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    private vouchersGateway: VouchersGateway,
  ) {}

  private generateVoucherCode(year: string, index: number): string {
    const paddedIndex = String(index).padStart(4, '0');
    return `QRB-${year}-${paddedIndex}`;
  }

  async findAll(eventId?: string, status?: string, search?: string): Promise<Voucher[]> {
    const qb = this.vouchersRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.event', 'event')
      .leftJoinAndSelect('v.createdBy', 'creator')
      .leftJoinAndSelect('v.claimedBy', 'claimer')
      .orderBy('v.created_at', 'DESC');

    if (eventId) {
      qb.andWhere('v.event_id = :eventId', { eventId });
    }
    if (status) {
      qb.andWhere('v.status = :status', { status });
    }
    if (search) {
      qb.andWhere('v.voucher_code ILIKE :search', { search: `%${search}%` });
    }

    const vouchers = await qb.getMany();
    return vouchers.map((v) => {
      if (v.createdBy) {
        delete (v.createdBy as any).password;
      }
      if (v.claimedBy) {
        delete (v.claimedBy as any).password;
      }
      return v;
    });
  }

  async exportCsv(eventId?: string, status?: string): Promise<string> {
    const vouchers = await this.findAll(eventId, status);
    const header = ['Kode Voucher', 'Event', 'Tahun', 'Status', 'Tgl Distribusi', 'Dibuat Oleh', 'Diklaim Oleh', 'Tgl Klaim'].join(',');
    const rows = vouchers.map(v => {
      return [
        v.voucherCode,
        v.event?.name || '',
        v.event?.year || '',
        v.status,
        v.distributionDate ? new Date(v.distributionDate).toISOString().split('T')[0] : '',
        v.createdBy?.fullName || '',
        v.claimedBy?.fullName || '',
        v.claimedAt ? new Date(v.claimedAt).toISOString() : '',
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    return [header, ...rows].join('\n');
  }

  async findById(id: string): Promise<Voucher> {
    const voucher = await this.vouchersRepository.findOne({
      where: { id },
      relations: ['event', 'createdBy', 'claimedBy', 'scanLogs', 'scanLogs.scannedBy'],
    });
    if (!voucher) throw new NotFoundException('Voucher tidak ditemukan');
    return voucher;
  }

  async findByCode(code: string): Promise<Voucher> {
    const voucher = await this.vouchersRepository.findOne({
      where: { voucherCode: code },
      relations: ['event', 'createdBy', 'claimedBy'],
    });
    if (!voucher) throw new NotFoundException('Voucher tidak ditemukan');
    return voucher;
  }

  async create(eventId: string, distributionDate: string, userId: string): Promise<Voucher> {
    const event = await this.eventsRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event tidak ditemukan');

    // Get the next voucher number
    const lastVoucher = await this.vouchersRepository
      .createQueryBuilder('v')
      .where('v.event_id = :eventId', { eventId })
      .orderBy('v.created_at', 'DESC')
      .getOne();

    let nextIndex = 1;
    if (lastVoucher) {
      const parts = lastVoucher.voucherCode.split('-');
      nextIndex = parseInt(parts[2], 10) + 1;
    }

    const voucherCode = this.generateVoucherCode(event.year, nextIndex);
    const qrData = JSON.stringify({ code: voucherCode, eventId, year: event.year });
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 1 });

    const voucher = this.vouchersRepository.create({
      eventId,
      voucherCode,
      qrData: qrDataUrl,
      distributionDate: distributionDate ? new Date(distributionDate) : undefined,
      createdById: userId,
    });

    return this.vouchersRepository.save(voucher) as Promise<Voucher>;
  }

  async createBatch(eventId: string, count: number, distributionDate: string, userId: string): Promise<Voucher[]> {
    const vouchers: Voucher[] = [];
    for (let i = 0; i < count; i++) {
      const voucher = await this.create(eventId, distributionDate, userId);
      vouchers.push(voucher);
    }
    return vouchers;
  }

  async scan(voucherCode: string, userId: string): Promise<{ voucher: Voucher; message: string }> {
    let voucher: Voucher;
    try {
      voucher = await this.findByCode(voucherCode);
    } catch {
      // Log failed scan - skip logging since no voucher found
      throw new NotFoundException('Voucher tidak ditemukan');
    }

    if (voucher.status === VoucherStatus.CLAIMED) {
      await this.scanLogsRepository.save({
        voucherId: voucher.id,
        scannedById: userId,
        action: 'REJECTED',
        notes: 'Voucher sudah diklaim sebelumnya',
      });
      throw new BadRequestException('Voucher sudah diklaim sebelumnya');
    }

    if (voucher.status === VoucherStatus.CANCELLED) {
      await this.scanLogsRepository.save({
        voucherId: voucher.id,
        scannedById: userId,
        action: 'REJECTED',
        notes: 'Voucher sudah dibatalkan',
      });
      throw new BadRequestException('Voucher sudah dibatalkan');
    }

    // Claim the voucher
    voucher.status = VoucherStatus.CLAIMED;
    voucher.claimedById = userId;
    voucher.claimedAt = new Date();
    const saved = await this.vouchersRepository.save(voucher);

    // Log successful scan
    await this.scanLogsRepository.save({
      voucherId: voucher.id,
      scannedById: userId,
      action: 'CLAIMED',
      notes: 'Voucher berhasil diklaim',
    });

    // Notify connected clients (Dashboard)
    this.vouchersGateway.notifyVoucherClaimed({ voucherCode });

    return { voucher: saved, message: 'Voucher berhasil diklaim!' };
  }

  async generatePdf(id: string): Promise<Buffer> {
    const voucher = await this.vouchersRepository.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!voucher) throw new NotFoundException('Voucher tidak ditemukan');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [300, 450],
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Background
      doc.rect(0, 0, 300, 450).fill('#f0fdf4');

      // Border
      doc.rect(10, 10, 280, 430).lineWidth(2).stroke('#059669');
      doc.rect(15, 15, 270, 420).lineWidth(0.5).stroke('#059669');

      // Logo
      if (voucher.event?.logoPath) {
        const logoFile = path.join(process.cwd(), voucher.event.logoPath.replace('/api/uploads/', 'uploads/'));
        if (fs.existsSync(logoFile)) {
          try {
            doc.image(logoFile, 115, 25, { width: 70, height: 70 });
          } catch (e) {
            // Skip logo if it can't be loaded
          }
        }
      }

      const logoOffset = voucher.event?.logoPath ? 100 : 30;

      // Mosque name
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#065f46')
        .text('MASJID AL HIJRAH CGE', 20, logoOffset, { width: 260, align: 'center' });

      // Divider
      doc
        .moveTo(40, logoOffset + 22)
        .lineTo(260, logoOffset + 22)
        .lineWidth(1)
        .stroke('#059669');

      // Title
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#047857')
        .text('KUPON PENGAMBILAN', 20, logoOffset + 32, { width: 260, align: 'center' })
        .text(`DAGING KURBAN ${voucher.event?.year || ''}`, 20, logoOffset + 50, { width: 260, align: 'center' });

      // Divider
      doc
        .moveTo(40, logoOffset + 72)
        .lineTo(260, logoOffset + 72)
        .lineWidth(0.5)
        .stroke('#059669');

      // QR Code
      if (voucher.qrData) {
        try {
          const qrBuffer = Buffer.from(voucher.qrData.split(',')[1], 'base64');
          doc.image(qrBuffer, 75, logoOffset + 82, { width: 150, height: 150 });
        } catch (e) {
          doc.fontSize(10).text('QR Code Error', 75, logoOffset + 140, { width: 150, align: 'center' });
        }
      }

      // Voucher code
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#065f46')
        .text(voucher.voucherCode, 20, logoOffset + 242, { width: 260, align: 'center' });

      // Date
      if (voucher.distributionDate) {
        const dateStr = new Date(voucher.distributionDate).toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#047857')
          .text(`Tanggal: ${dateStr}`, 20, logoOffset + 265, { width: 260, align: 'center' });
      }

      // Footer decorative line
      doc
        .moveTo(40, logoOffset + 290)
        .lineTo(260, logoOffset + 290)
        .lineWidth(0.5)
        .stroke('#059669');

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#6b7280')
        .text('Tunjukkan kupon ini kepada panitia untuk pengambilan daging', 20, logoOffset + 298, {
          width: 260,
          align: 'center',
        });

      doc.end();
    });
  }

  async generateBatchPdf(eventId: string): Promise<Buffer> {
    const vouchers = await this.vouchersRepository.find({
      where: { eventId, status: VoucherStatus.ACTIVE },
      relations: ['event'],
      order: { voucherCode: 'ASC' },
    });

    if (vouchers.length === 0) {
      throw new NotFoundException('Tidak ada voucher aktif untuk event ini');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const itemsPerPage = 5;
      const voucherHeight = 150;
      const voucherMargin = 10;
      const startX = 20;
      const width = 555;

      vouchers.forEach((voucher, index) => {
        if (index > 0 && index % itemsPerPage === 0) {
          doc.addPage();
        }

        const positionInPage = index % itemsPerPage;
        const startY = 20 + (positionInPage * (voucherHeight + voucherMargin));

        // Background & Border
        doc.rect(startX, startY, width, voucherHeight).fillAndStroke('#f0fdf4', '#059669');
        doc.rect(startX + 5, startY + 5, width - 10, voucherHeight - 10).lineWidth(0.5).stroke('#059669');

        // Logo
        let logoOffset = 0;
        if (voucher.event?.logoPath) {
          const logoFile = path.join(process.cwd(), voucher.event.logoPath.replace('/api/uploads/', 'uploads/'));
          if (fs.existsSync(logoFile)) {
            try {
              doc.image(logoFile, startX + 20, startY + 40, { width: 70, height: 70 });
              logoOffset = 100;
            } catch (e) {
              // Skip logo
            }
          }
        }

        // Mosque name & Title
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#065f46')
           .text('MASJID AL HIJRAH CGE', startX + 30 + logoOffset, startY + 30, { width: 300, align: 'left' });
        
        doc.moveTo(startX + 30 + logoOffset, startY + 48).lineTo(startX + 300 + logoOffset, startY + 48).lineWidth(1).stroke('#059669');
        
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#047857')
           .text(`KUPON PENGAMBILAN DAGING KURBAN ${voucher.event?.year || ''}`, startX + 30 + logoOffset, startY + 55, { width: 300, align: 'left' });

        doc.font('Helvetica-Bold').fontSize(16).fillColor('#065f46')
           .text(voucher.voucherCode, startX + 30 + logoOffset, startY + 85, { width: 300, align: 'left' });

        if (voucher.distributionDate) {
          const dateStr = new Date(voucher.distributionDate).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          doc.font('Helvetica').fontSize(10).fillColor('#047857')
             .text(`Tanggal: ${dateStr}`, startX + 30 + logoOffset, startY + 110, { width: 300, align: 'left' });
        }

        // QR Code
        if (voucher.qrData) {
          try {
            const qrBuffer = Buffer.from(voucher.qrData.split(',')[1], 'base64');
            doc.image(qrBuffer, startX + width - 130, startY + 25, { width: 100, height: 100 });
          } catch (e) {
            doc.fontSize(10).text('QR Error', startX + width - 130, startY + 70);
          }
        }

        // Footer decorative text
        doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
           .text('Tunjukkan kupon ini kepada panitia untuk pengambilan daging', startX + width - 150, startY + 130, { width: 140, align: 'center' });
      });

      doc.end();
    });
  }

  async remove(id: string): Promise<void> {
    const voucher = await this.findById(id);
    // Delete scan logs first
    await this.scanLogsRepository.delete({ voucherId: id });
    await this.vouchersRepository.remove(voucher);
  }

  async stats(eventId?: string) {
    const qb = this.vouchersRepository.createQueryBuilder('v');
    if (eventId) {
      qb.where('v.event_id = :eventId', { eventId });
    }

    const total = await qb.getCount();

    const claimed = await qb
      .clone()
      .andWhere('v.status = :status', { status: VoucherStatus.CLAIMED })
      .getCount();

    const active = await qb
      .clone()
      .andWhere('v.status = :status', { status: VoucherStatus.ACTIVE })
      .getCount();

    const cancelled = await qb
      .clone()
      .andWhere('v.status = :status', { status: VoucherStatus.CANCELLED })
      .getCount();

    return { total, claimed, active, cancelled };
  }

  async getScanLogs(eventId?: string): Promise<ScanLog[]> {
    const qb = this.scanLogsRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.voucher', 'voucher')
      .leftJoinAndSelect('sl.scannedBy', 'scanner')
      .orderBy('sl.scanned_at', 'DESC')
      .take(50);

    if (eventId) {
      qb.andWhere('voucher.event_id = :eventId', { eventId });
    }

    const logs = await qb.getMany();
    return logs.map((l) => {
      if (l.scannedBy) delete (l.scannedBy as any).password;
      return l;
    });
  }
}
