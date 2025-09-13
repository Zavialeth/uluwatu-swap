// src/abi/minimal.ts
// Minimale ABIs om pools en factory te lezen

// --- Factory ABI ---
// Alleen de functie om een pooladres op te vragen op basis van token0, token1 en fee
export const UNISWAP_FACTORY_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "tokenA", "type": "address" },
      { "internalType": "address", "name": "tokenB", "type": "address" },
      { "internalType": "uint24",  "name": "fee",    "type": "uint24" }
    ],
    "name": "getPool",
    "outputs": [
      { "internalType": "address", "name": "pool", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const


// --- Pool ABI ---
// Bevat liquiditeit, slot0 en factory() om de "eigenaar" te controleren
export const UNISWAP_POOL_ABI = [
  {
    "inputs": [],
    "name": "liquidity",
    "outputs": [
      { "internalType": "uint128", "name": "", "type": "uint128" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "slot0",
    "outputs": [
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" },
      { "internalType": "int24",   "name": "tick", "type": "int24" },
      { "internalType": "uint16",  "name": "observationIndex", "type": "uint16" },
      { "internalType": "uint16",  "name": "observationCardinality", "type": "uint16" },
      { "internalType": "uint16",  "name": "observationCardinalityNext", "type": "uint16" },
      { "internalType": "uint8",   "name": "feeProtocol", "type": "uint8" },
      { "internalType": "bool",    "name": "unlocked", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "factory",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const
