// src/debug/verifyPool.ts
// Doel: trustless checken dat jouw app naar DEZELFDE pool kijkt als jij verwacht,
// en dat de pool geïnitialiseerd is + (optioneel) actieve liq heeft.

import { UNISWAP_FACTORY_ABI, UNISWAP_POOL_ABI } from "../abi/minimal";

type Address = `0x${string}`

export async function verifyPoolWiring({
  publicClient,
  factory,
  token0,
  token1,
  fee,
  expectedPool
}: {
  publicClient: any,        // viem publicClient (bv. uit wagmi: usePublicClient())
  factory: Address,         // Factory address (Sushi V3 of Uniswap V3, afhankelijk van jouw setup)
  token0: Address,          // VITE_TOKEN0
  token1: Address,          // VITE_TOKEN1
  fee: number,              // VITE_FEE (10000=1%, 3000=0.3%, 500=0.05%, 100=0.01%)
  expectedPool: Address     // VITE_EXPECTED_POOL (van DEXTools/Arbiscan)
}) {
  const log = (...x: any[]) => console.log('%c[POOL VERIFY]', 'color:#0984e3;font-weight:bold', ...x)

  // 1) Vraag pool uit de factory op basis van token0/token1/fee
  const poolFromFactory = await publicClient.readContract({
    address: factory,
    abi: UNISWAP_FACTORY_ABI,
    functionName: 'getPool',
    args: [token0, token1, fee]
  }) as Address

  log('Factory.getPool =>', poolFromFactory)

  if (poolFromFactory === '0x0000000000000000000000000000000000000000') {
    throw new Error('Factory.getPool gaf 0x0 terug. Controleer chain, factory, tokens en fee tier.')
  }

  // 2) Vergelijk met jouw EXPECTED_POOL (van DEXTools)
  if (poolFromFactory.toLowerCase() !== expectedPool.toLowerCase()) {
    throw new Error(`ENV mismatch: Factory.getPool ≠ EXPECTED_POOL (${poolFromFactory} ≠ ${expectedPool})`)
  }

  // 3) Lees basis pool-state + check dat pool bij JOUW factory hoort
  const [liq, slot0, poolFactoryAddr] = await Promise.all([
    publicClient.readContract({
      address: expectedPool,
      abi: UNISWAP_POOL_ABI,
      functionName: 'liquidity'
    }) as Promise<bigint>,
    publicClient.readContract({
      address: expectedPool,
      abi: UNISWAP_POOL_ABI,
      functionName: 'slot0'
    }) as Promise<any>,
    publicClient.readContract({
      address: expectedPool,
      abi: UNISWAP_POOL_ABI,
      functionName: 'factory'
    }) as Promise<Address>,
  ])

  log('Pool.factory() =>', poolFactoryAddr)
  log('liquidity =>', liq.toString())
  const sqrtPriceX96 = (slot0?.sqrtPriceX96 ?? 0n) as bigint
  log('sqrtPriceX96 =>', sqrtPriceX96.toString())

  // 4) Interpretatie
  const initialized = sqrtPriceX96 !== 0n
  if (!initialized) throw new Error('Pool niet geïnitialiseerd (sqrtPriceX96 = 0).')

  // Actieve liq op huidige prijs? (informatief; 0 kan duiden op out-of-range TVL)
  if (liq === 0n) {
    log('⚠️  Pool heeft 0 “actieve” liquidity op de huidige prijs (kan nog steeds TVL out-of-range hebben).')
  }

  return {
    ok: true,
    pool: expectedPool,
    poolFromFactory,
    poolFactoryAddr,
    liquidity: liq,
    tick: Number(slot0?.tick ?? 0),
    initialized
  }
}
