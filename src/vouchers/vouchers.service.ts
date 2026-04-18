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



  async generateBatchPdf(eventId: string): Promise<Buffer> {
    const vouchers = await this.vouchersRepository.find({
      where: { eventId, status: VoucherStatus.ACTIVE },
      relations: ['event'],
      order: { voucherCode: 'ASC' },
    });

    if (!vouchers || vouchers.length === 0) {
      throw new NotFoundException('Tidak ada voucher aktif untuk event ini');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: false,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // A4 = 595.28 x 841.89 points
      const PAGE_HEIGHT = 841.89;
      const ITEMS_PER_PAGE = 5;
      const PAGE_PADDING_TOP = 10;
      const PAGE_PADDING_BOTTOM = 10;
      const CARD_GAP = 8;
      const usableHeight = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
      // (5 * cardH) + (4 * CARD_GAP) = usableHeight
      const CARD_H = Math.floor((usableHeight - (ITEMS_PER_PAGE - 1) * CARD_GAP) / ITEMS_PER_PAGE);
      const CARD_X = 18;
      const CARD_W = 595.28 - 2 * CARD_X;

      const t = (text: string, x: number, y: number, opts: any = {}) => {
        doc.text(text, x, y, { ...opts, lineBreak: false });
      };

      for (let i = 0; i < vouchers.length; i++) {
        const voucher = vouchers[i];

        // New page every 5 vouchers
        if (i % ITEMS_PER_PAGE === 0) {
          doc.addPage({ size: 'A4', margin: 0 });
        }

        const slot = i % ITEMS_PER_PAGE;
        const y = PAGE_PADDING_TOP + slot * (CARD_H + CARD_GAP);

        // ─── Card Background ───
        doc.save();
        doc.roundedRect(CARD_X, y, CARD_W, CARD_H, 6).fillAndStroke('#ffffff', '#e5e7eb');
        doc.restore();

        // ─── Top color bar (clipped inside card) ───
        doc.save();
        doc.roundedRect(CARD_X, y, CARD_W, CARD_H, 6).clip();
        doc.rect(CARD_X, y, CARD_W / 2, 4).fill('#10b981');
        doc.rect(CARD_X + CARD_W / 2, y, CARD_W / 2, 4).fill('#3b82f6');
        doc.restore();

        // ─── Logo / Fallback ───
        let hasLogo = false;
        if (voucher.event?.logoPath) {
          const logoFile = path.join(process.cwd(), voucher.event.logoPath.replace('/api/uploads/', 'uploads/'));
          if (fs.existsSync(logoFile)) {
            try {
              doc.image(logoFile, CARD_X + 15, y + 18, { width: 38, height: 38 });
              hasLogo = true;
            } catch (e) { /* skip */ }
          }
        }
        if (!hasLogo) {
          doc.roundedRect(CARD_X + 12, y + 15, 44, 44, 8).fillAndStroke('#ecfdf5', '#d1fae5');
          doc.font('Helvetica-Bold').fontSize(13).fillColor('#10b981');
          t('CGE', CARD_X + 12, y + 30, { width: 44, align: 'center' });
        }

        // ─── Year Pill ───
        let yearText = '';
        if (voucher.distributionDate) {
          try {
            const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic', { year: 'numeric' });
            const hijriParts = hijriFormatter.format(new Date(voucher.distributionDate)).split(' ');
            const hijri = hijriParts[0] + ' H';
            const masehi = new Date(voucher.distributionDate).getFullYear() + ' M';
            yearText = `Idul Adha ${hijri} / ${masehi}`;
          } catch { yearText = `Idul Adha ${voucher.event?.year || ''}`; }
        } else {
          yearText = `Idul Adha ${voucher.event?.year || ''}`;
        }
        doc.roundedRect(CARD_X + 70, y + 16, 155, 16, 8).fill('#ecfdf5');
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#10b981');
        t(yearText, CARD_X + 70, y + 20, { width: 155, align: 'center' });

        // ─── Title ───
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a432e');
        t('KUPON DAGING KURBAN', CARD_X + 70, y + 38);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280');
        t('Masjid Al Hijrah CGE', CARD_X + 70, y + 56);

        // ─── ID KUPON box ───
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#6b7280');
        t('#  ID KUPON', CARD_X + 15, y + 78);
        doc.roundedRect(CARD_X + 15, y + 90, 165, 22, 4).fillAndStroke('#f9fafb', '#e5e7eb');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#10b981');
        t(voucher.voucherCode, CARD_X + 15, y + 96, { width: 165, align: 'center' });

        // ─── TANGGAL box ───
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#6b7280');
        t('TANGGAL', CARD_X + 200, y + 78);
        doc.roundedRect(CARD_X + 200, y + 90, 165, 22, 4).fillAndStroke('#f9fafb', '#e5e7eb');
        const dateStr = voucher.distributionDate
          ? new Date(voucher.distributionDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : '-';
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
        t(dateStr, CARD_X + 200, y + 96, { width: 165, align: 'center' });

        // ─── Dotted separator ───
        doc.save();
        doc.moveTo(CARD_X + 385, y + 12)
           .lineTo(CARD_X + 385, y + CARD_H - 12)
           .lineWidth(1).dash(3, { space: 3 }).stroke('#d1d5db');
        doc.undash();
        doc.restore();

        // ─── QR Code area ───
        doc.roundedRect(CARD_X + 400, y + 12, CARD_W - 400 - 12, CARD_H - 24, 6).fill('#ecfdf5');
        if (voucher.qrData && voucher.qrData.includes(',')) {
          try {
            const qrBuffer = Buffer.from(voucher.qrData.split(',')[1], 'base64');
            doc.image(qrBuffer, CARD_X + 412, y + 18, { width: 82, height: 82 });
          } catch (e) { /* skip */ }
        }
        doc.font('Helvetica-Bold').fontSize(5).fillColor('#10b981');
        t('SCAN UNTUK VERIFIKASI', CARD_X + 400, y + CARD_H - 30, { width: CARD_W - 400 - 12, align: 'center' });
        t('OLEH PANITIA', CARD_X + 400, y + CARD_H - 23, { width: CARD_W - 400 - 12, align: 'center' });

        // ─── Footer text ───
        doc.font('Helvetica').fontSize(6).fillColor('#9ca3af');
        t('ⓘ Tunjukkan kupon ini saat pengambilan. Hanya panitia yang boleh memindai.', CARD_X + 15, y + CARD_H - 16);
      }

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
