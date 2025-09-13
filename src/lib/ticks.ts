import { TICKS } from '../config'

export function fullRangeTicks(fee: number) {
  const spacing = TICKS.SPACING[fee as 100 | 500 | 3000 | 10000]
  if (!spacing) throw new Error(`Unsupported fee tier: ${fee}`)
  // Clamp to bounds & align to spacing
  const lower = Math.floor(TICKS.MIN_TICK / spacing) * spacing
  const upper = Math.floor(TICKS.MAX_TICK / spacing) * spacing
  return { tickLower: lower, tickUpper: upper }
}

