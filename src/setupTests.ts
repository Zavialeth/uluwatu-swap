// src/setupTests.ts — shared test setup
import "@testing-library/jest-dom";

// vitest globals (fallback, mocht je per ongeluk niet importeren in een test)
import {
  expect as viExpect,
  test as viTest,
  it as viIt,
  describe as viDescribe,
  beforeAll as viBeforeAll,
  afterAll as viAfterAll,
  beforeEach as viBeforeEach,
  afterEach as viAfterEach,
  vi,
} from "vitest";

(globalThis as any).test = (globalThis as any).test || viTest;
(globalThis as any).it = (globalThis as any).it || viIt;
(globalThis as any).describe = (globalThis as any).describe || viDescribe;
(globalThis as any).expect = (globalThis as any).expect || viExpect;
(globalThis as any).beforeAll = (globalThis as any).beforeAll || viBeforeAll;
(globalThis as any).afterAll = (globalThis as any).afterAll || viAfterAll;
(globalThis as any).beforeEach = (globalThis as any).beforeEach || viBeforeEach;
(globalThis as any).afterEach = (globalThis as any).afterEach || viAfterEach;

// wagmi mock (voorkomt WagmiProviderNotFoundError in jsdom)
vi.mock("wagmi", async () => {
  return {
    useAccount: () => ({
      address: "0x0000000000000000000000000000000000000000",
      status: "connected",
      isConnected: true,
      isDisconnected: false,
    }),
    usePublicClient: () => ({}),
    useWalletClient: () => ({ data: null }),
    WagmiProvider: ({ children }: any) => children,
  };
});

// config fallback-mock voor tests
vi.mock("../config", async () => {
  const ADDR = {
    WETH:       "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    DEFI_D:     "0xd772ced5e24068fff90a0a0e6ab76e0f3a8005a6",
    NFPM:       "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    POOL_FEE:   10000,
    CHAIN_ID:   42161,
    ACTIVE_POOL:"0xd64b58d3f46affdf98414d6e9a593ba04b2c086e",
  };
  const ABIS = { ERC20_ABI: [], WETH_ABI: [], V3_POOL_ABI: [], NFPM_ABI: [] };
  const cfg = () => ({ ADDR, ABIS });
  const resolveActivePool = async (_p:any,_t0:string,_t1:string,_f:number,hint?:string) =>
    hint || ADDR.ACTIVE_POOL;
  return { ADDR, ABIS, cfg, resolveActivePool };
});
