import { PublicPengkurbanController } from './public-pengkurban.controller';
import { PricingCatalog } from '../common/pricing.constants';

describe('PublicPengkurbanController.getPricing', () => {
  let controller: PublicPengkurbanController;

  beforeEach(() => {
    controller = new PublicPengkurbanController({} as any);
  });

  it('returns infaq field per tier for domba/kambing', () => {
    const result = controller.getPricing() as PricingCatalog;
    expect(result.domba[0].infaq).toBe(300_000);
    expect(result.kambing[0].infaq).toBe(300_000);
    expect(result.domba.every((t) => t.infaq === 300_000)).toBe(true);
    expect(result.kambing.every((t) => t.infaq === 300_000)).toBe(true);
  });

  it('returns infaq for sapi kolektif opsi A & B', () => {
    const result = controller.getPricing() as PricingCatalog;
    expect(result.sapiKolektif.opsiA.infaq).toBe(300_000);
    expect(result.sapiKolektif.opsiB.infaq).toBe(300_000);
  });

  it('returns infaq for sapi perorangan', () => {
    const result = controller.getPricing() as PricingCatalog;
    expect(result.sapiPerorangan.infaq).toBe(1_750_000);
  });
});
