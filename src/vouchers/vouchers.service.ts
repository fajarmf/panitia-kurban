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

    const voucherCode = await this.generateUniqueCode(distributionDate ? new Date(distributionDate) : new Date());
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
      const voucherHeight = 155;
      const voucherMargin = 10;
      const startX = 20;
      const width = 555;

      vouchers.forEach((voucher, index) => {
        if (index > 0 && index % itemsPerPage === 0) {
          doc.addPage();
        }

        const positionInPage = index % itemsPerPage;
        const startY = 15 + (positionInPage * (voucherHeight + voucherMargin));

        // Card Background & Border
        doc.roundedRect(startX, startY, width, voucherHeight, 8).fillAndStroke('#ffffff', '#e5e7eb');
        
        // Top Split Border
        doc.save();
        doc.roundedRect(startX, startY, width, voucherHeight, 8).clip();
        doc.rect(startX, startY, width / 2, 5).fill('#10b981'); // Emerald
        doc.rect(startX + width / 2, startY, width / 2, 5).fill('#3b82f6'); // Blue
        doc.restore();

        // Left Icon Box
        doc.roundedRect(startX + 20, startY + 20, 45, 45, 10).fillAndStroke('#ecfdf5', '#d1fae5');
        doc.save();
        doc.translate(startX + 30, startY + 30);
        doc.scale(1.2);
        doc.path('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z').fill('#10b981');
        doc.restore();

        // Year Pill
        let yearText = voucher.event?.year || '';
        if (voucher.distributionDate) {
           const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic', { year: 'numeric' });
           const hijriParts = hijriFormatter.format(new Date(voucher.distributionDate)).split(' ');
           const hijri = hijriParts[0] + ' H';
           const masehi = new Date(voucher.distributionDate).getFullYear() + ' M';
           yearText = `Idul Adha ${hijri} / ${masehi}`;
        } else {
           yearText = `Idul Adha ${yearText}`;
        }
        
        doc.roundedRect(startX + 80, startY + 20, 160, 18, 9).fill('#ecfdf5');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#10b981')
           .text(yearText, startX + 80, startY + 25, { width: 160, align: 'center' });

        // Titles
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a432e')
           .text('KUPON DAGING KURBAN', startX + 80, startY + 45);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#6b7280')
           .text('Masjid Al Hijrah CGE', startX + 80, startY + 65);

        // Details Section
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#6b7280')
           .text('#  ID KUPON', startX + 20, startY + 95);
        doc.roundedRect(startX + 20, startY + 110, 170, 25, 4).fillAndStroke('#f9fafb', '#e5e7eb');
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#10b981')
           .text(voucher.voucherCode, startX + 20, startY + 118, { width: 170, align: 'center' });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#6b7280')
           .text('TANGGAL', startX + 210, startY + 95);
        doc.roundedRect(startX + 210, startY + 110, 170, 25, 4).fillAndStroke('#f9fafb', '#e5e7eb');
        const dateStr = voucher.distributionDate ? new Date(voucher.distributionDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
           .text(dateStr, startX + 210, startY + 118, { width: 170, align: 'center' });

        // Dotted Line
        doc.moveTo(startX + 400, startY + 15)
           .lineTo(startX + 400, startY + 140)
           .lineWidth(1).dash(2, {space: 3}).stroke('#d1d5db');
        doc.undash();

        // QR Box
        doc.roundedRect(startX + 420, startY + 15, 115, 110, 8).fill('#ecfdf5');
        if (voucher.qrData) {
          try {
            const qrBuffer = Buffer.from(voucher.qrData.split(',')[1], 'base64');
            doc.image(qrBuffer, startX + 432, startY + 22, { width: 90, height: 90 });
          } catch(e) {}
        }
        doc.font('Helvetica-Bold').fontSize(6).fillColor('#10b981')
           .text('SCAN UNTUK VERIFIKASI', startX + 420, startY + 130, { width: 115, align: 'center' })
           .text('OLEH PANITIA', startX + 420, startY + 138, { width: 115, align: 'center' });

        // Footer info text
        doc.circle(startX + 25, startY + 143, 5).lineWidth(1).stroke('#9ca3af');
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#9ca3af').text('i', startX + 23, startY + 140, { width: 4, align: 'center' });
        doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
           .text('Tunjukkan kupon ini saat pengambilan. Hanya panitia yang boleh memindai.', startX + 35, startY + 140);
      });

      doc.end();
    });
  }

  private async generateUniqueCode(distributionDate: Date): Promise<string> {
    const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', { year: 'numeric' });
    const hijriYearRaw = hijriFormatter.format(distributionDate);
    const hijriYear = hijriYearRaw.split(' ')[0];

    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let isUnique = false;

    while (!isUnique) {
      let randomPart = '';
      for (let i = 0; i < 10; i++) {
        randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      code = `QRB-${hijriYear}H-${randomPart}`;
      const existing = await this.vouchersRepository.findOne({ where: { voucherCode: code } });
      if (!existing) {
        isUnique = true;
      }
    }
    return code;
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
      .orderBy('sl.scannedAt', 'DESC')
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
