// src/lib/ticks.ts

// Canonical Uniswap/Sushi v3 tick-bounds
export const MIN_TICK = -887272
export const MAX_TICK = 887272

// Tick spacing per fee tier (v3 standaarden)
// 0.01% → 100 ; 0.05% → 500 ; 0.3% → 3000 ; 1% → 10000
export type FeeTier = 100 | 500 | 3000 | 10000
export const SPACING: Record<FeeTier, number> = {
  100: 1,     // 0.01%
  500: 10,    // 0.05%
  3000: 60,   // 0.3%
  10000: 200  // 1%
}

// Voor code die { TICKS } uit deze module verwacht
export const TICKS = {
  MIN_TICK,
  MAX_TICK,
  SPACING
} as const

/**
 * Berekent een full-range voor de opgegeven fee-tier, netjes uitgelijnd op de spacing.
 * Houdt rekening met de globale MIN_TICK / MAX_TICK grenzen.
 */
export function fullRangeTicks(fee: number) {
  const spacing = SPACING[fee as FeeTier]
  if (!spacing) throw new Error(`Unsupported fee tier: ${fee}`)

  // Align naar dichtstbijzijnde geldige ticks binnen de bounds
  const lower = Math.ceil(MIN_TICK / spacing) * spacing
  const upper = Math.floor(MAX_TICK / spacing) * spacing

  if (lower >= upper) throw new Error(`Invalid full range for spacing=${spacing}`)
  return { tickLower: lower, tickUpper: upper }
}
