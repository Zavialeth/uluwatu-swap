// src/config.ts

/**
 * ✅ Doel van dit bestand:
 * - Behoud je bestaande env-gedreven configuratie voor Trade.tsx (ongewijzigd gedrag).
 * - Voeg de extra velden toe die Liquidity.tsx nodig heeft (ADDR.WETH/DEFI_D/NFPM/…).
 * - Laat .env overrides voorgaan, met werkende Arbitrum defaults als fallback.
 *
 * Je hoeft niets elders aan te passen.
 */

// -------------------- Bestaande (jouw) velden in ADDR --------------------
export const ADDR = {
  // QuoterV2 + Router op Arbitrum
  QUOTER_V2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  SWAP_ROUTER_02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",

  // -------------------- Nieuw: velden die Liquidity.tsx verwacht --------------------
  // Chain id (Arbitrum One = 42161)
  CHAIN_ID: Number.parseInt(import.meta.env?.VITE_CHAIN_ID ?? "42161"),

  // Token-adressen (kunnen via .env override worden gezet)
  // token0 = WETH
  WETH: (import.meta.env?.VITE_TOKEN0 ??
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1") as `0x${string}`,
  // token1 = DeFiD
  DEFI_D: (import.meta.env?.VITE_TOKEN1 ??
    "0xd772ced5e24068fff90a0a0e6ab76e0f3a8005a6") as `0x${string}`,

  // Sushi/Uniswap v3 NonfungiblePositionManager
  NFPM: (import.meta.env?.VITE_NFPM ??
    "0xC36442b4a4522E871399CD717aBDD847Ab11FE88") as `0x${string}`,

  // Actieve pool (WETH/DeFiD op 1%)
  ACTIVE_POOL: (import.meta.env?.VITE_POOL ??
    "0xd64b58d3f46affdf98414d6e9a593ba04b2c086e") as `0x${string}`,

  // Fee tier (default 1% = 10000)
  POOL_FEE: Number.parseInt(import.meta.env?.VITE_FEE ?? "10000"),

  // ETH-mode toggle (optioneel, default true)
  ETH_MODE: (import.meta.env?.VITE_ETH_MODE ?? "true") === "true",
} as const;

// -------------------- (optioneel) ABIS export --------------------
// Liquidity.tsx heeft een eigen fallback; we exporteren ABIS alleen om named-imports niet te breken.
// Als je later echte ABIs wilt centraliseren, zet ze hier in.
export const ABIS: any = undefined;

// -------------------- Bestaande cfg() (uitgebreid, maar backward compatible) --------------------
export function cfg() {
  // blijf je bestaande .env-waarden teruggeven
  const envShape = {
    VITE_CHAIN_ID: Number.parseInt(import.meta.env?.VITE_CHAIN_ID ?? "42161"),
    VITE_TOKEN0: import.meta.env?.VITE_TOKEN0 as `0x${string}` | undefined, // WETH
    VITE_TOKEN1: import.meta.env?.VITE_TOKEN1 as `0x${string}` | undefined, // DeFiD
    VITE_FEE: Number.parseInt(import.meta.env?.VITE_FEE ?? "10000"),
    VITE_NFPM: import.meta.env?.VITE_NFPM as `0x${string}` | undefined,
    VITE_ETH_MODE: (import.meta.env?.VITE_ETH_MODE ?? "true") === "true",
    VITE_POOL: import.meta.env?.VITE_POOL as `0x${string}` | undefined, // optional
  };

  // ➕ extra teruggeven voor Liquidity.tsx (verandert bestaand gebruik niet)
  return {
    ...envShape,
    ADDR,
    ABIS,
  };
}

// -------------------- Pool resolver --------------------
// Gebruik voorkeur: provided > VITE_POOL > ADDR.ACTIVE_POOL
export async function resolveActivePool(
  _provider: any,
  _token0: `0x${string}`,
  _token1: `0x${string}`,
  _fee: number,
  provided?: `0x${string}`
) {
  return (provided ?? (import.meta.env?.VITE_POOL as `0x${string}` | undefined) ?? ADDR.ACTIVE_POOL) as `0x${string}`;
}

// -------------------- Bestaande helpers (compat) --------------------
export function isEthMode() {
  return (import.meta.env?.VITE_ETH_MODE ?? "true") === "true";
}

// ✅ Test-compat: bied een env-shim voor bestaande tests
export const env = {
  VITE_POOL_ADDRESS:
    (typeof ADDR.ACTIVE_POOL === "string" && ADDR.ACTIVE_POOL) ? ADDR.ACTIVE_POOL : "",
};
