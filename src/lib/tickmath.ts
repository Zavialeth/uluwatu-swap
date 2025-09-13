export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}
