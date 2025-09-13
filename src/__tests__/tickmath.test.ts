// src/__tests__/tickmath.test.ts
import { priceToTick, tickToPrice } from '../lib/tickmath'

test('tick and price conversion', () => {
  const price = 2000;
  const tick = priceToTick(price);
  expect(tickToPrice(tick)).toBeGreaterThan(0);
});
