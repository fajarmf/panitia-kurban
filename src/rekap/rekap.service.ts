import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pengkurban } from '../pengkurban/pengkurban.entity';
import { Donation } from '../donations/donation.entity';
import { getInfaqAmount } from '../common/constants/infaq';

function displayName(p: Pengkurban): string {
  return (p.shohibulName || p.name).split('\n')[0].trim();
}

function formatRibu(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return '';
  if (amount >= 1_000_000 && amount % 1_000_000 === 0)
    return `${amount / 1_000_000} juta`;
  if (amount % 1000 === 0) return `${amount / 1000} ribu`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

@Injectable()
export class RekapService {
  constructor(
    @InjectRepository(Pengkurban)
    private pengkurbanRepo: Repository<Pengkurban>,
    @InjectRepository(Donation)
    private donationRepo: Repository<Donation>,
  ) {}

  private async fetchPengkurban(eventId?: string): Promise<Pengkurban[]> {
    const where = eventId ? { eventId } : {};
    return this.pengkurbanRepo.find({
      where,
      relations: ['event'],
      order: { createdAt: 'ASC' },
    });
  }

  private async fetchDonations(eventId?: string): Promise<Donation[]> {
    const where = eventId ? { eventId } : {};
    return this.donationRepo.find({
      where,
      relations: ['event'],
      order: { createdAt: 'ASC' },
    });
  }

  async getPengkurbanRekap(eventId?: string): Promise<string> {
    const data = await this.fetchPengkurban(eventId);
    const active = data.filter((d) => d.status !== ('REJECTED' as never));

    const sapiA = active.filter(
      (d) => d.animalType === ('SAPI_KOLEKTIF_A' as never),
    );
    const sapiB = active.filter(
      (d) => d.animalType === ('SAPI_KOLEKTIF_B' as never),
    );
    const sapiLegacy = active.filter(
      (d) => d.animalType === ('SAPI_KOLEKTIF' as never),
    );
    const sapiPerorangan = active.filter(
      (d) => d.animalType === ('SAPI_PERORANGAN' as never),
    );
    const kambingDomba = active.filter(
      (d) =>
        d.animalType === ('KAMBING' as never) ||
        d.animalType === ('DOMBA' as never),
    );

    const check = (d: Pengkurban) =>
      d.infaqPaid ? ' ✅' : '';

    const lines: string[] = [
      `*Daftar Pengkurban*`,
      ``,
      `Keterangan: ✅ = sudah verifikasi infaq`,
      ``,
    ];

    const renderKolektif = (rows: Pengkurban[], header: string) => {
      lines.push(header);
      for (let i = 0; i < 7; i++) {
        const d = rows[i];
        if (d) lines.push(`${i + 1}. ${displayName(d)}${check(d)}`);
        else lines.push(`${i + 1}. ...`);
      }
      lines.push(``);
    };

    if (sapiA.length || sapiB.length || sapiLegacy.length) {
      lines.push(`Qurban Sapi Kolektif`);
      renderKolektif(sapiA, `• Sapi A 350 - 400 Kg Rp 4.000.000 / orang`);
      renderKolektif(sapiB, `• Sapi B 320 - 350 Kg Rp 3.500.000 / orang`);
      if (sapiLegacy.length) renderKolektif(sapiLegacy, `• Sapi Kolektif`);
    }

    lines.push(`Qurban Sapi perorangan`);
    if (sapiPerorangan.length) {
      sapiPerorangan.forEach((d, i) =>
        lines.push(`${i + 1}. ${displayName(d)}${check(d)}`),
      );
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);

    lines.push(`Qurban Kambing dan Domba`);
    if (kambingDomba.length) {
      kambingDomba.forEach((d, i) => {
        const jenis = d.animalType === ('DOMBA' as never) ? 'Domba' : 'Kambing';
        const tier = d.animalSize ? ` - ${d.animalSize}` : '';
        lines.push(`${i + 1}. ${displayName(d)} (${jenis}${tier})${check(d)}`);
      });
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);

    lines.push(`Jazakumullahu Khairan.`);
    lines.push(``);
    lines.push(`Panitia Idul Adha 1447 H`);
    lines.push(`DKM Al Hijrah – Cluster Maranos CGE`);

    return lines.join('\n');
  }

  async getDonasiRekap(eventId?: string): Promise<string> {
    const [donations, pengkurban] = await Promise.all([
      this.fetchDonations(eventId),
      this.fetchPengkurban(eventId),
    ]);

    const activeDonations = donations.filter(
      (d) => d.status !== ('REJECTED' as never),
    );

    const lines: string[] = [`*List Sumbangan Kegiatan Idul Qurban*`, ``];

    // Sohibul Qurban — semua active (non-REJECTED), ✅ kalau infaq_paid
    const pkActive = pengkurban.filter(
      (d) => d.status !== ('REJECTED' as never),
    );
    lines.push(`• Sohibul Qurban`);
    if (pkActive.length) {
      pkActive.forEach((d, i) => {
        const name = displayName(d);
        const amt = formatRibu(getInfaqAmount(d.animalType as string));
        const check = d.infaqPaid ? ' ✅' : '';
        lines.push(`${i + 1}. ${name}${amt ? ' ' + amt : ''}${check}`);
      });
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);

    // Sukarela Warga — semua active (non-REJECTED), ✅ kalau CONFIRMED
    lines.push(`• Sukarela Warga`);
    if (activeDonations.length) {
      activeDonations.forEach((d, i) => {
        const amt = formatRibu(d.amount == null ? null : Number(d.amount));
        const check = d.status === ('CONFIRMED' as never) ? ' ✅' : '';
        lines.push(`${i + 1}. ${d.name}${amt ? ' ' + amt : ''}${check}`);
      });
    } else {
      [1, 2, 3, 4, 5].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);

    lines.push(
      `Rekening Bank Muamalat | 12 1010 4479 a/n Masjid Al Hijrah CGE 11`,
    );
    lines.push(``);
    lines.push(`Donasi online: https://kurban.masjidalhijrahcge.id/donate.html`);
    lines.push(``);
    lines.push(`Konfirmasi`);
    lines.push(
      `di: https://kurban.masjidalhijrahcge.id  atau Whatsapp ke Fajar Firdaus (0812-7149-927) / Panitia Kurban (0851-2151-9870).`,
    );
    lines.push(``);
    lines.push(`Jazakumullahu Khairan.`);
    lines.push(``);
    lines.push(`Panitia Idul Adha 1447 H`);
    lines.push(`DKM Al Hijrah – Cluster Maranos CGE`);

    return lines.join('\n');
  }
}
