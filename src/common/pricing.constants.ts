import { AnimalType } from './enums/animal-type.enum';

export interface TierPrice {
  size: string;
  weight: string;
  price?: number;
  priceMin?: number;
  priceMax?: number;
  priceNote?: string;
  infaq: number;
}

export interface SapiKolektifOption {
  perOrang: number;
  beratSapi: string;
  label: string;
  infaq: number;
}

export interface PricingCatalog {
  domba: TierPrice[];
  kambing: TierPrice[];
  sapiKolektif: {
    opsiA: SapiKolektifOption;
    opsiB: SapiKolektifOption;
    orangPerEkor: number;
    jenisSapi: string;
  };
  sapiPerorangan: {
    infaq: number;
    note: string;
  };
}

const INFAQ_KAMBING_DOMBA = 300_000;
const INFAQ_SAPI_KOLEKTIF = 300_000;
const INFAQ_SAPI_PERORANGAN = 1_750_000;

export const PRICING: PricingCatalog = {
  domba: [
    { size: 'Tipe A', weight: '30 kg', price: 2_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe B', weight: '40 kg', price: 3_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe C', weight: '50 kg', price: 4_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Super', weight: '60-90 kg', priceMin: 5_600_000, priceMax: 9_000_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Istimewa', weight: '>100 kg', priceNote: 'hubungi panitia', infaq: INFAQ_KAMBING_DOMBA },
  ],
  kambing: [
    { size: 'Tipe A', weight: '30 kg', price: 3_000_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe B', weight: '40 kg', price: 3_950_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Tipe C', weight: '50 kg', price: 5_000_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Super', weight: '60-90 kg', priceMin: 5_650_000, priceMax: 9_200_000, infaq: INFAQ_KAMBING_DOMBA },
    { size: 'Istimewa', weight: '>100 kg', priceNote: 'hubungi panitia', infaq: INFAQ_KAMBING_DOMBA },
  ],
  sapiKolektif: {
    opsiA: { perOrang: 4_000_000, beratSapi: '350-400 kg', label: 'Sapi A', infaq: INFAQ_SAPI_KOLEKTIF },
    opsiB: { perOrang: 3_500_000, beratSapi: '320-350 kg', label: 'Sapi B', infaq: INFAQ_SAPI_KOLEKTIF },
    orangPerEkor: 7,
    jenisSapi: 'Sapi Bali',
  },
  sapiPerorangan: {
    infaq: INFAQ_SAPI_PERORANGAN,
    note: 'Harga sesuai kesepakatan',
  },
};

export const INFAQ_BY_ANIMAL: Record<string, number> = {
  [AnimalType.DOMBA]: INFAQ_KAMBING_DOMBA,
  [AnimalType.KAMBING]: INFAQ_KAMBING_DOMBA,
  [AnimalType.SAPI_KOLEKTIF]: INFAQ_SAPI_KOLEKTIF,
  [AnimalType.SAPI_KOLEKTIF_A]: INFAQ_SAPI_KOLEKTIF,
  [AnimalType.SAPI_KOLEKTIF_B]: INFAQ_SAPI_KOLEKTIF,
  [AnimalType.SAPI_PERORANGAN]: INFAQ_SAPI_PERORANGAN,
};
