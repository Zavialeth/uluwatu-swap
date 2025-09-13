import { describe, it, expect } from "vitest";
import { priceFromSqrtPrice, fullRange, MIN_TICK, MAX_TICK, Q96 } from "../Liquidity";

// Helper for approximate float comparisons
const approx = (a: number, b: number, tol = 1e-9) =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// Accept both +0 and -0 (Object.is strictness)
const isZero = (n: number) => Object.is(n, 0) || Object.is(n, -0);

describe("priceFromSqrtPrice", () => {
  it("returns ≈1 when sqrtPriceX96 == Q96 and decimals equal", () => {
    const p = priceFromSqrtPrice(Q96 as unknown as bigint, 18, 18);
    expect(approx(p, 1)).toBe(true);
  });

  it("scales quadratically: doubling sqrt gives ~4x price", () => {
    const p = priceFromSqrtPrice(Q96 as unknown as bigint, 18, 18);
    const p4 = priceFromSqrtPrice((Q96 * 2n) as unknown as bigint, 18, 18);
    expect(approx(p4 / p, 4)).toBe(true);
  });

  it("applies decimal correction: dec1 - dec0 = +12 gives 1e12", () => {
    const p = priceFromSqrtPrice(Q96 as unknown as bigint, 6, 18);
    expect(approx(p, 1e12)).toBe(true);
  });

  // Boundary/guard tests
  it("throws on sqrtPriceX96 = 0", () => {
    expect(() => priceFromSqrtPrice(0n as unknown as bigint, 18, 18)).toThrow();
  });

  it("throws on negative decimals", () => {
    expect(() => priceFromSqrtPrice(Q96 as unknown as bigint, -1, 18)).toThrow();
    expect(() => priceFromSqrtPrice(Q96 as unknown as bigint, 18, -1)).toThrow();
  });
});

describe("fullRange", () => {
  it("aligns ticks on spacing 200 and stays within global bounds", () => {
    const { tickLower, tickUpper } = fullRange(200);
    expect(isZero(tickLower % 200)).toBe(true);
    expect(isZero(tickUpper % 200)).toBe(true);
    expect(tickLower).toBeGreaterThanOrEqual(MIN_TICK);
    expect(tickUpper).toBeLessThanOrEqual(MAX_TICK);
    expect(tickLower).toBeLessThan(tickUpper);
  });

  it("works for a few other common spacings (50, 60)", () => {
    for (const s of [50, 60]) {
      const { tickLower, tickUpper } = fullRange(s);
      expect(isZero(tickLower % s)).toBe(true);
      expect(isZero(tickUpper % s)).toBe(true);
      expect(tickLower).toBeGreaterThanOrEqual(MIN_TICK);
      expect(tickUpper).toBeLessThanOrEqual(MAX_TICK);
      expect(tickLower).toBeLessThan(tickUpper);
    }
  });

  it("throws on non-positive spacing or impossible alignment", () => {
    expect(() => fullRange(0)).toThrow();
    expect(() => fullRange(-10)).toThrow();
    // Extremely large spacing can cause lowAligned >= upAligned
    expect(() => fullRange(1_000_000)).toThrow();
  });
});

it("fullRange(200) stays within global tick bounds", () => {
  const { tickLower, tickUpper } = fullRange(200);
  expect(tickLower).toBeGreaterThanOrEqual(MIN_TICK);
  expect(tickUpper).toBeLessThanOrEqual(MAX_TICK);
});
