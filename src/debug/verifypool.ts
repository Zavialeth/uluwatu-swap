import { UNISWAP_FACTORY_ABI, UNISWAP_POOL_ABI } from '@/abi/minimal'

type Address = `0x${string}`

export async function verifyPoolWiring({
  publicClient,
  factory,
  token0,
  token1,
  fee,
  expectedPool
}: {
  publicClient: any,
  factory: Address,
  token0: Address,
  token1: Address,
  fee: number,
  expectedPool: Address
}) {
  const log = (...x:any[]) => console.log('%c[POOL VERIFY]', 'color:#0984e3;font-weight:bold', ...x)

  // 1) Vraag de pool op uit de factory (bron van waarheid)
  const poolFromFactory = await publicClient.readContract({
    address: factory,
    abi: UNISWAP_FACTORY_ABI,
    functionName: 'getPool',
    args: [token0, token1, fee]
  }) as Address
  log('Factory.getPool =>', poolFromFactory)

  if (poolFromFactory.toLowerCase() !== expectedPool.toLowerCase()) {
    throw new Error(`ENV mismatch: Factory.getPool ≠ EXPECTED_POOL (${poolFromFactory} ≠ ${expectedPool})`)
  }

  // 2) Basis pool-state
  const [liq, slot0, poolFactoryAddr] = await Promise.all([
    publicClient.readContract({ address: expectedPool, abi: UNISWAP_POOL_ABI, functionName: 'liquidity' }) as Promise<bigint>,
    publicClient.readContract({ address: expectedPool, abi: UNISWAP_POOL_ABI, functionName: 'slot0' }) as Promise<any>,
    publicClient.readContract({ address: expectedPool, abi: UNISWAP_POOL_ABI, functionName: 'factory' }) as Promise<Address>,
  ])

  log('Pool.factory() =>', poolFactoryAddr)
  log('liquidity =>', liq.toString())
  log('sqrtPriceX96 =>', (slot0?.sqrtPriceX96 ?? 0n).toString())

  // 3) Interpretatie
  const initialized = (slot0?.sqrtPriceX96 ?? 0n) !== 0n
  if (!initialized) throw new Error('Pool niet geïnitialiseerd (sqrtPriceX96 = 0).')
  if (liq === 0n) log('⚠️ Pool heeft 0 “actieve” liquidity op de huidige prijs (kan nog steeds TVL out-of-range hebben).')
  
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
