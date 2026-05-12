import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pengkurban } from '../pengkurban/pengkurban.entity';
import { Donation } from '../donations/donation.entity';
import { getInfaqAmount } from '../common/constants/infaq';

function displayName(p: Pengkurban): string {
  return (p.shohibulName || p.name).split('\n')[0].trim();
}

const REKENING_DEFAULT =
  'Rekening Bank Muamalat | 12 1010 4479 a/n Masjid Al Hijrah CGE 11';

// Rekening line yang ditampilkan di akhir rekap. Override pakai env
// REKAP_REKENING (kalau bank/rekening berubah tahun depan, ga perlu code change).
function getRekening(): string {
  return process.env.REKAP_REKENING?.trim() || REKENING_DEFAULT;
}

// Display-oriented blok extractor for rekap pengkurban. Returns uppercase,
// space-separated tokens matching the format panitia broadcasts use
// (e.g. "NHT 3/50", "M6/102", "MGT 2/22"). Empty string if no address.
function formatBlokShort(addr: string | null | undefined): string {
  if (!addr) return '';
  let s = String(addr).split('\n')[0].trim();
  if (!s) return '';
  s = s.replace(/^(Margata\s*-\s*)+/i, '');
  let m = s.match(/^Nahara(?:\s+Timur)?\s*-\s*(.+)$/i);
  if (m) {
    const rest = m[1].trim();
    const nht = rest.match(/^NHT\s*(.+)$/i);
    return nht ? `NHT ${nht[1].trim()}` : `NHT ${rest}`;
  }
  m = s.match(/Margata\s+(\d+)\s+no\.?\s*(\d+)/i);
  if (m) return `M${m[1]}/${m[2]}`;
  m = s.match(/^Uenos\s*(\d+)\s*[/\\]\s*(\d+)/i);
  if (m) return `U${m[1]}/${m[2]}`;
  m = s.match(/^MGT\b\s*(.+)$/i);
  if (m) return `MGT ${m[1].trim()}`;
  m = s.match(/^M\s*(\d+)\s*[/\\]\s*(\d+)/i);
  if (m) return `M${m[1]}/${m[2]}`;
  m = s.match(/^M\s*(\d+)\b/i);
  if (m) return `M${m[1]}`;
  m = s.match(/^NHT\s*(.+)$/i);
  if (m) return `NHT ${m[1].trim()}`;
  return s;
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
    const sapiC = active.filter(
      (d) => d.animalType === ('SAPI_KOLEKTIF_C' as never),
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

    const check = (d: Pengkurban) => (d.infaqPaid ? ' ✅' : '');
    const blok = (d: Pengkurban) => {
      const b = formatBlokShort(d.address);
      return b ? ` ${b}` : '';
    };

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
        if (d) lines.push(`${i + 1}. ${displayName(d)}${blok(d)}${check(d)}`);
        else lines.push(`${i + 1}. ...`);
      }
      lines.push(``);
    };

    if (sapiA.length || sapiB.length || sapiC.length || sapiLegacy.length) {
      lines.push(`Qurban Sapi Kolektif`);
      renderKolektif(sapiA, `• Sapi A 350 - 400 Kg Rp 4.000.000 / orang`);
      renderKolektif(
        sapiB,
        `• Sapi B 320 - 350 Kg Rp 3.500.000 / orang (sudah termasuk infaq)`,
      );
      renderKolektif(
        sapiC,
        `• Sapi C 320 - 350 Kg Rp 3.500.000 / orang (sudah termasuk infaq)`,
      );
      if (sapiLegacy.length) renderKolektif(sapiLegacy, `• Sapi Kolektif`);
    }

    lines.push(`Qurban Sapi perorangan`);
    if (sapiPerorangan.length) {
      sapiPerorangan.forEach((d, i) =>
        lines.push(`${i + 1}. ${displayName(d)}${blok(d)}${check(d)}`),
      );
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);

    lines.push(`Qurban Kambing dan Domba`);
    if (kambingDomba.length) {
      kambingDomba.forEach((d, i) => {
        const jenis = d.animalType === ('DOMBA' as never) ? 'Domba' : 'Kambing';
        const isBawaSendiri = d.purchaseType === ('BAWA_SENDIRI' as never);
        // animal_size legacy yg berisi "bawa sendiri" (manual workaround sebelum
        // logic ini ada) di-skip biar ga dobel.
        const sizeStr =
          d.animalSize && !/bawa\s*sendiri/i.test(d.animalSize)
            ? d.animalSize
            : '';
        const suffix = isBawaSendiri
          ? ` - Bawa sendiri${sizeStr ? ' ' + sizeStr : ''}`
          : sizeStr
            ? ` - ${sizeStr}`
            : '';
        lines.push(
          `${i + 1}. ${displayName(d)} (${jenis}${suffix})${blok(d)}${check(d)}`,
        );
      });
    } else {
      [1, 2, 3].forEach((i) => lines.push(`${i}. ...`));
    }
    lines.push(``);

    const infoPemesanan = process.env.REKAP_INFO_PEMESANAN?.trim();
    if (infoPemesanan) {
      lines.push(infoPemesanan);
      lines.push(``);
    }

    lines.push(`Pembayaran:`);
    lines.push(getRekening());
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

    lines.push(getRekening());
    lines.push(``);
    lines.push(
      `Donasi online: https://kurban.masjidalhijrahcge.id/donate.html`,
    );
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
