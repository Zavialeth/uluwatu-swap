// src/config.ts

/**
 * Centrale configuratie voor UluwatuSwap:
 * - Arbitrum defaults
 * - ENV-overrides via VITE_* (optioneel)
 * - Export ADDR (incl. FACTORY), TICKS, helpers, én 'env' voor tests
 */

// ----- Defaults -----
const DEFAULTS = {
  CHAIN_ID: 42161,
  // Infra
  QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  SWAP_ROUTER_02: '0x68b3465833FB72A70EcDF485E0e4C7bD8665Fc45',
  NFPM: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  FACTORY: '0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e',
  // Tokens / Pool (jouw setup)
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  DEFI_D: '0xd772ced5e24068fff90a0a0e6ab76e0f3a8005a6',
  ACTIVE_POOL: '0xd64b58d3f46affdf98414d6e9a593ba04b2c086e',
  FEE_TIER: 10000, // 1%
  ETH_MODE: true
} as const

// ----- Vite env (safe fallback als import.meta niet bestaat tijdens build) -----
// Belangrijk: we exporteren 'env' expliciet omdat je test die importeert.
export const env = (typeof import.meta !== 'undefined'
  ? ((import.meta as any).env ?? {})
  : {}) as Record<string, string | undefined>

// ----- Centrale adressen (met env-overrides waar logisch) -----
export const ADDR = {
  QUOTER_V2: (env.VITE_QUOTER_V2 ?? DEFAULTS.QUOTER_V2) as `0x${string}`,
  SWAP_ROUTER_02: (env.VITE_SUSHI_V3_ROUTER_02 ?? env.VITE_SWAP_ROUTER_02 ?? DEFAULTS.SWAP_ROUTER_02) as `0x${string}`,
  CHAIN_ID: Number.parseInt(env.VITE_CHAIN_ID ?? String(DEFAULTS.CHAIN_ID)),
  WETH: (env.VITE_TOKEN0 ?? env.VITE_WETH ?? DEFAULTS.WETH) as `0x${string}`,
  DEFI_D: (env.VITE_TOKEN1 ?? DEFAULTS.DEFI_D) as `0x${string}`,
  NFPM: (env.VITE_NFPM ?? DEFAULTS.NFPM) as `0x${string}`,
  FACTORY: (env.VITE_FACTORY ?? DEFAULTS.FACTORY) as `0x${string}`,
  ACTIVE_POOL: (env.VITE_POOL ?? env.VITE_POOL_ADDRESS ?? DEFAULTS.ACTIVE_POOL) as `0x${string}`,
  POOL_FEE: Number.parseInt(env.VITE_FEE ?? String(DEFAULTS.FEE_TIER)),
  ETH_MODE: (env.VITE_ETH_MODE ?? String(DEFAULTS.ETH_MODE)) === 'true'
} as const

// ----- Compat TICKS export (voor code die dit verwacht) -----
export const TICKS: number[] = []

// Handige alias-exports (optioneel)
export const POOL = ADDR.ACTIVE_POOL
export const ROUTER = ADDR.SWAP_ROUTER_02
export const FEE_TIER = ADDR.POOL_FEE
export const CHAIN_ID = ADDR.CHAIN_ID

// ABIS placeholder (named-imports breken niet)
export const ABIS: any = undefined

// ----- cfg(): vorm die sommige UI-delen verwachten -----
export function cfg() {
  return {
    VITE_CHAIN_ID: Number.parseInt(env.VITE_CHAIN_ID ?? String(DEFAULTS.CHAIN_ID)),
    VITE_TOKEN0: env.VITE_TOKEN0 as `0x${string}` | undefined,
    VITE_TOKEN1: env.VITE_TOKEN1 as `0x${string}` | undefined,
    VITE_FEE: Number.parseInt(env.VITE_FEE ?? String(DEFAULTS.FEE_TIER)),
    VITE_NFPM: env.VITE_NFPM as `0x${string}` | undefined,
    VITE_ETH_MODE: (env.VITE_ETH_MODE ?? String(DEFAULTS.ETH_MODE)) === 'true',
    VITE_POOL: env.VITE_POOL as `0x${string}` | undefined,
    VITE_FACTORY: env.VITE_FACTORY as `0x${string}` | undefined,
    VITE_SWAP_ROUTER_02: (env.VITE_SUSHI_V3_ROUTER_02 ?? env.VITE_SWAP_ROUTER_02) as `0x${string}` | undefined,
    VITE_QUOTER_V2: env.VITE_QUOTER_V2 as `0x${string}` | undefined,
    ADDR,
    ABIS
  }
}

// ----- Pool resolver: provided > VITE_POOL > ADDR.ACTIVE_POOL -----
export async function resolveActivePool(
  _provider: any,
  _token0: `0x${string}`,
  _token1: `0x${string}`,
  _fee: number,
  provided?: `0x${string}`
) {
  return (provided ?? (env.VITE_POOL as `0x${string}` | undefined) ?? ADDR.ACTIVE_POOL) as `0x${string}`
}

// ----- Helper voor UI-toggles -----
export function isEthMode() {
  return (env.VITE_ETH_MODE ?? String(DEFAULTS.ETH_MODE)) === 'true'
}

// ----- Test-compat shim -----
export const testEnvShim = {
  VITE_POOL_ADDRESS: ADDR.ACTIVE_POOL
}
