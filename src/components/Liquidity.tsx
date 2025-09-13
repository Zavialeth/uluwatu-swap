// src/components/Liquidity.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ADDR, ABIS, cfg, resolveActivePool, isEthMode } from "../config";

// ---------- Constants ----------
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
const ONE = 1n;
export const Q96 = ONE << 96n;
const MAX_UINT128 = (ONE << 128n) - 1n;

// ---------- Helpers ----------
const posZero = (n: number) => (Object.is(n, -0) ? 0 : n);
const isZero = (n: number) => Object.is(n, 0) || Object.is(n, -0);

export function fullRange(spacing: number) {
  if (spacing <= 0) throw new Error("Tick spacing must be positive");
  const lowAligned = Math.ceil(MIN_TICK / spacing) * spacing;
  const upAligned = Math.floor(MAX_TICK / spacing) * spacing;
  if (lowAligned >= upAligned) throw new Error("Invalid fullRange alignment");
  return { tickLower: posZero(lowAligned), tickUpper: posZero(upAligned) };
}

export function priceFromSqrtPrice(
  sqrtPriceX96: bigint,
  decimalsToken0: number,
  decimalsToken1: number
) {
  if (sqrtPriceX96 <= 0n) throw new Error("Invalid sqrtPriceX96");
  if (decimalsToken0 < 0 || decimalsToken1 < 0) throw new Error("Invalid decimals");
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  if (!Number.isFinite(ratio)) throw new Error("Invalid ratio computed");
  const base = ratio * ratio;
  const scale = 10 ** (decimalsToken1 - decimalsToken0);
  const out = base * scale;
  if (!Number.isFinite(out)) throw new Error("Non-finite price result");
  return out;
}

export type LiquidityProps = { testOverrides?: { price?: number } };

function formatAmount(v?: string | number, maxFrac = 6) {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return "-";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

// ---------- Wallet hook (robuuster t.o.v. Web3Modal timing) ----------
function useEthers() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const eth = (window as any).ethereum;
      if (!eth) return;

      const p = new ethers.BrowserProvider(eth, "any");
      if (!alive) return;
      setProvider(p);

      try {
        const net = await p.getNetwork();
        if (!alive) return;
        setChainId(Number(net.chainId));
      } catch {}

      try {
        const accs: string[] = await p.send("eth_accounts", []);
        if (accs && accs.length > 0) {
          const s = await p.getSigner();
          if (!alive) return;
          setSigner(s);
          setAddress(await s.getAddress());
        }
      } catch {}

      const t0 = Date.now();
      const poll = setInterval(async () => {
        try {
          const accs: string[] = await p.send("eth_accounts", []);
          if (accs && accs.length > 0) {
            const s = await p.getSigner();
            setSigner(s);
            setAddress(await s.getAddress());
            clearInterval(poll);
          }
          if (Date.now() - t0 > 3000) clearInterval(poll);
        } catch {
          clearInterval(poll);
        }
      }, 400);

      eth?.on?.("connect", async () => {
        try {
          const net = await p.getNetwork();
          setChainId(Number(net.chainId));
          const s = await p.getSigner();
          setSigner(s);
          setAddress(await s.getAddress());
        } catch {}
      });
      eth?.on?.("accountsChanged", async (accs: string[]) => {
        if (accs?.length) {
          const s = await p.getSigner();
          setSigner(s);
          setAddress(accs[0]);
        } else {
          setSigner(null);
          setAddress("");
        }
      });
      eth?.on?.("chainChanged", async (cid: string) => {
        const n = Number(cid);
        setChainId(Number.isNaN(n) ? null : n);
        try {
          const s = await p.getSigner();
          setSigner(s);
          setAddress(await s.getAddress());
        } catch {}
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { provider, signer, address, chainId };
}

// ---------- Contract helpers ----------
function roContract(addr: string, abi: any, provider: ethers.Provider) {
  return new ethers.Contract(addr, abi, provider);
}
function rwContract(addr: string, abi: any, signer: ethers.Signer) {
  return new ethers.Contract(addr, abi, signer);
}

// ---------- Arbiscan helpers ----------
const arbTx = (hash: string) => `https://arbiscan.io/tx/${hash}`;
const arbAddr = (addr: string) => `https://arbiscan.io/address/${addr}`;
const arbNft = (nft: string, tokenId: string | number | bigint) =>
  `https://arbiscan.io/nft/${nft}/${tokenId.toString()}`;

// ---------- Canonical ABIs ----------
const NFPM_POSITIONS_SIG =
  "function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)";
const NFPM_COLLECT_SIG =
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)";
const NFPM_DECREASE_SIG =
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) returns (uint256 amount0, uint256 amount1)";
const NFPM_MINT_SIG =
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)";
const NFPM_INCREASE_SIG =
  "function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) returns (uint128 liquidity, uint256 amount0, uint256 amount1)";
const NFPM_ENUM_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  NFPM_POSITIONS_SIG,
];

const ERC20_ABI_FALLBACK = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const WETH_ABI_FALLBACK = [
  "function deposit() payable",
  "function withdraw(uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const V3_POOL_ABI_FALLBACK = [
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function tickSpacing() view returns (int24)",
  "function fee() view returns (uint24)",
];

// ---------- Component ----------
const Liquidity: React.FC<LiquidityProps> = ({ testOverrides }) => {
  const { provider, signer, address, chainId } = useEthers();
  const conf = (typeof cfg === "function" ? cfg() : {}) as any;

  const WETH = conf.ADDR?.WETH ?? ADDR?.WETH ?? "0x0000000000000000000000000000000000000000";
  const DEFI_D = conf.ADDR?.DEFI_D ?? ADDR?.DEFI_D ?? "0x0000000000000000000000000000000000000000";
  const NFPM = conf.ADDR?.NFPM ?? ADDR?.NFPM ?? "0x0000000000000000000000000000000000000000";
  const POOL_FEE = conf.ADDR?.POOL_FEE ?? ADDR?.POOL_FEE ?? 10000;
  const REQUIRED_CHAIN = conf.ADDR?.CHAIN_ID ?? ADDR?.CHAIN_ID ?? 42161;

  const [poolAddr, setPoolAddr] = useState<string>(conf.ADDR?.ACTIVE_POOL || ADDR?.ACTIVE_POOL || "");
  const [decWeth, setDecWeth] = useState<number>(18);
  const [decDefiD, setDecDefiD] = useState<number>(18);
  const [sqrtPriceX96, setSqrtPriceX96] = useState<bigint | null>(null);
  const [tickSpacing, setTickSpacing] = useState<number>(200);
  const [poolToken0, setPoolToken0] = useState<string | null>(null);
  const [poolToken1, setPoolToken1] = useState<string | null>(null);
  const [poolFeeRead, setPoolFeeRead] = useState<number | null>(null);

  const [price, setPrice] = useState<number>(testOverrides?.price ?? 0);

  const [readProvider, setReadProvider] = useState<ethers.Provider | null>(null);
  useEffect(() => {
    if (provider) {
      setReadProvider(provider);
      return;
    }
    const p = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
    setReadProvider(p);
  }, [provider]);

  // UI inputs
  const [amountEth, setAmountEth] = useState<string>("");
  const [amountDefiD, setAmountDefiD] = useState<string>("");
  const [amountDefiDBuffer, setAmountDefiDBuffer] = useState<string>("");

  // Positions
  const [matchedTokenId, setMatchedTokenId] = useState<string | null>(null);
  const [loadedPosition, setLoadedPosition] = useState<any | null>(null);
  const [claimable0, setClaimable0] = useState<bigint | null>(null);
  const [claimable1, setClaimable1] = useState<bigint | null>(null);

  // Wallet state
  const [balEth, setBalEth] = useState<string>("0");
  const [balWeth, setBalWeth] = useState<string>("0");
  const [balDefiD, setBalDefiD] = useState<string>("0");
  const [allowWeth, setAllowWeth] = useState<string>("0");
  const [allowDefiD, setAllowDefiD] = useState<string>("0");

  // Ops/logs
  const [busy, setBusy] = useState<boolean>(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [lastTokenId, setLastTokenId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = useCallback((m: string) => setLogs((x) => [m, ...x]), []);

  const onWrongChain = useMemo(
    () => chainId !== null && REQUIRED_CHAIN !== null && chainId !== REQUIRED_CHAIN,
    [chainId, REQUIRED_CHAIN]
  );
  const ready = useMemo(() => Boolean(provider && signer && address), [provider, signer, address]);

  // ---------- Load pool / price (SILENT by default) ----------
  const loadOnchain = useCallback(
    async () => {
      const p = readProvider ?? provider;
      if (!p) return;
      try {
        const pool = await resolveActivePool(
          p,
          WETH as `0x${string}`,
          DEFI_D as `0x${string}`,
          POOL_FEE,
          poolAddr as `0x${string}`
        );
        setPoolAddr(pool);

        const poolC = roContract(pool, ABIS?.V3_POOL_ABI ?? V3_POOL_ABI_FALLBACK, p);
        const [slot0, spacing, t0, t1, feeRead] = await Promise.all([
          poolC.slot0(),
          poolC.tickSpacing(),
          poolC.token0(),
          poolC.token1(),
          poolC.fee(),
        ]);

        setTickSpacing(Number(spacing));
        setPoolToken0(t0);
        setPoolToken1(t1);
        setPoolFeeRead(Number(feeRead));

        const erc20 = ABIS?.ERC20_ABI ?? ERC20_ABI_FALLBACK;
        const [d0, d1] = await Promise.all([
          roContract(WETH, erc20, p).decimals(),
          roContract(DEFI_D, erc20, p).decimals(),
        ]);
        setDecWeth(Number(d0));
        setDecDefiD(Number(d1));

        const sqrt = BigInt(slot0.sqrtPriceX96);
        setSqrtPriceX96(sqrt);
        const newPrice = priceFromSqrtPrice(sqrt, Number(d0), Number(d1));
        setPrice(newPrice);
      } catch {
        // silent
      }
    },
    [readProvider, provider, WETH, DEFI_D, POOL_FEE, poolAddr]
  );

  useEffect(() => {
    if (!readProvider) return;
    loadOnchain(); // silent on mount
  }, [readProvider, loadOnchain]);

  // ---------- Auto-calc UI ----------
  useEffect(() => {
    const v = Number(amountEth);
    if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(price) || price <= 0) {
      setAmountDefiD("");
      setAmountDefiDBuffer("");
      return;
    }
    const needed = v * price;
    const buffered = needed * 1.003;
    setAmountDefiD(formatAmount(needed, 6));
    setAmountDefiDBuffer(formatAmount(buffered, 6));
  }, [amountEth, price]);

  // ---------- Wallet state ----------
  const refreshWalletState = useCallback(async () => {
    if (!provider || !signer || !address) return;
    try {
      const erc20 = ABIS?.ERC20_ABI ?? ERC20_ABI_FALLBACK;
      const weth = roContract(WETH, erc20, provider);
      const defi = roContract(DEFI_D, erc20, provider);

      const [ethBal, wethBal, defiBal, allowW, allowD] = await Promise.all([
        provider.getBalance(address),
        weth.balanceOf(address),
        defi.balanceOf(address),
        weth.allowance(address, NFPM),
        defi.allowance(address, NFPM),
      ]);

      setBalEth(ethers.formatEther(ethBal));
      setBalWeth(ethers.formatUnits(wethBal, decWeth));
      setBalDefiD(ethers.formatUnits(defiBal, decDefiD));
      setAllowWeth(ethers.formatUnits(allowW, decWeth));
      setAllowDefiD(ethers.formatUnits(allowD, decDefiD));
    } catch {
      // silent
    }
  }, [provider, signer, address, WETH, DEFI_D, NFPM, decWeth, decDefiD]);

  useEffect(() => {
    refreshWalletState();
  }, [refreshWalletState]);

  // ---------- Utils ----------
  const toUnits = (valNum: number, decimals: number) =>
    ethers.parseUnits(valNum.toFixed(Math.min(6, decimals)), decimals);

  const findMatchingPositionNow = useCallback(
    async (want0: string, want1: string, wantFee: number): Promise<string | null> => {
      if (!signer || !address) return null;
      const nfpm = rwContract(NFPM, ABIS?.NFPM_ENUM_ABI ?? NFPM_ENUM_ABI, signer);
      try {
        const bal: bigint = await nfpm.balanceOf(address);
        if (bal === 0n) return null;
        const want0LC = want0.toLowerCase();
        const want1LC = want1.toLowerCase();
        for (let i = 0n; i < bal; i++) {
          try {
            const tid: bigint = await nfpm.tokenOfOwnerByIndex(address, i);
            const pos = await nfpm.positions(tid);
            const t0 = String(pos.token0).toLowerCase();
            const t1 = String(pos.token1).toLowerCase();
            const fee = Number(pos.fee);
            const match =
              (t0 === want0LC && t1 === want1LC && fee === wantFee) ||
              (t0 === want1LC && t1 === want0LC && fee === wantFee);
            if (match) return tid.toString();
          } catch {}
        }
        return null;
      } catch {
        return null;
      }
    },
    [signer, address, NFPM]
  );

  // ---------- Supply (Mint or Increase) ----------
  const doSupply = useCallback(async () => {
    if (!provider || !signer || !address) return addLog("❌ Connect your wallet first.");
    if (onWrongChain) return addLog(`❌ Wrong chain. Please switch to Arbitrum (42161).`);
    if (!poolAddr || !poolToken0 || !poolToken1 || !tickSpacing) {
      return addLog("❌ Pool not resolved yet. Click 'Reload price' first.");
    }
    if (poolFeeRead !== null && Number(poolFeeRead) !== Number(POOL_FEE)) {
      return addLog(`❌ Config fee tier (${POOL_FEE}) does not match pool fee (${poolFeeRead}). Fix config and retry.`);
    }

    const ethAmountNum = Number(amountEth);
    if (!Number.isFinite(ethAmountNum) || ethAmountNum <= 0) {
      return addLog("❌ Enter a valid ETH amount.");
    }
    if (!(price > 0)) return addLog("❌ Price not loaded yet.");

    setBusy(true);
    setLastTx(null);

    try {
      const neededDeFiD = ethAmountNum * price;
      const rawWethDesired = ethers.parseUnits(ethAmountNum.toFixed(decWeth), decWeth);
      const rawDefiDesired = toUnits(neededDeFiD, decDefiD);

      const t0 = (poolToken0 || "").toLowerCase();
      const t1 = (poolToken1 || "").toLowerCase();
      const amount0Desired = t0 === WETH.toLowerCase() ? rawWethDesired : rawDefiDesired;
      const amount1Desired = t1 === DEFI_D.toLowerCase() ? rawDefiDesired : rawWethDesired;

      addLog(`ℹ️ Desired: amount0=${amount0Desired.toString()} amount1=${amount1Desired.toString()}`);
      if (amount0Desired === 0n || amount1Desired === 0n) {
        setBusy(false);
        return addLog("❌ One of desired amounts equals 0. Try a larger amount.");
      }

      const erc20 = ABIS?.ERC20_ABI ?? ERC20_ABI_FALLBACK;
      const weth = rwContract(WETH, erc20, signer);
      const defi = rwContract(DEFI_D, erc20, signer);
      const [rawEthBal, rawWethBal, rawDefiBal] = await Promise.all([
        provider.getBalance(address),
        weth.balanceOf(address),
        defi.balanceOf(address),
      ]);

      const wantWeth = t0 === WETH.toLowerCase() ? amount0Desired : amount1Desired;
      const wantDefi = t0 === DEFI_D.toLowerCase() ? amount0Desired : amount1Desired;
      addLog(
        `ℹ️ Need vs Have:\n- WETH need ${ethers.formatUnits(wantWeth, decWeth)} | have ${ethers.formatUnits(
          rawWethBal,
          decWeth
        )}\n- DeFiD need ${ethers.formatUnits(wantDefi, decDefiD)} | have ${ethers.formatUnits(
          rawDefiBal,
          decDefiD
        )}`
      );

      // Wrap ETH → WETH if needed
      if (isEthMode && wantWeth > rawWethBal) {
        const diff = wantWeth - rawWethBal;
        if (rawEthBal < diff)
          return addLog(`❌ Not enough ETH to wrap. Need extra ${ethers.formatUnits(diff, decWeth)} ETH.`);
        addLog(`⛏️ Wrapping ETH → WETH: ${ethers.formatUnits(diff, decWeth)} WETH`);
        const wethC = new ethers.Contract(WETH, ABIS?.WETH_ABI ?? WETH_ABI_FALLBACK, signer);
        const txWrap = await wethC.deposit({ value: diff });
        addLog(`🔄 wrap tx: ${arbTx(txWrap.hash)}`);
        await txWrap.wait();
        addLog(`✅ Wrapped.`);
      }

      // Approvals to NFPM
      const needApprove = async (token: ethers.Contract, amount: bigint, sym: string) => {
        const current: bigint = await token.allowance(address, NFPM);
        if (current >= amount) return;
        addLog(`🔓 Approving ${sym} to NFPM (max)…`);
        const tx = await token.approve(NFPM, ethers.MaxUint256);
        addLog(`🔄 approve ${sym}: ${arbTx(tx.hash)}`);
        await tx.wait();
        addLog(`✅ ${sym} approved.`);
      };
      await needApprove(weth, wantWeth, "WETH");
      await needApprove(defi, wantDefi, "DeFiD");

      // Detect existing position live
      const liveMatch = await findMatchingPositionNow(poolToken0!, poolToken1!, Number(poolFeeRead ?? POOL_FEE));
      if (liveMatch) addLog(`🔁 Existing position detected (tokenId=${liveMatch}) → increaseLiquidity.`);
      const tokenIdForIncrease = liveMatch || matchedTokenId || null;

      // NFPM
      const nfpm = rwContract(
        NFPM,
        ABIS?.NFPM_ABI ?? [NFPM_MINT_SIG, NFPM_INCREASE_SIG, NFPM_POSITIONS_SIG, "event Transfer(address,address,uint256)"],
        signer
      );

      const amount0Min = 1n;
      const amount1Min = 1n;

      if (tokenIdForIncrease) {
        // INCREASE
        const incParams = {
          tokenId: BigInt(tokenIdForIncrease),
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
        } as const;

        try {
          const sim = await nfpm.increaseLiquidity.staticCall(incParams);
          const liqPlus = sim[0] as bigint;
          const a0 = sim[1] as bigint;
          const a1 = sim[2] as bigint;
          addLog(`🧪 Sim increase → liq+${liqPlus.toString()} amount0=${a0.toString()} amount1=${a1.toString()}`);
          if (liqPlus === 0n && a0 === 0n && a1 === 0n) {
            setBusy(false);
            return addLog("❌ Simulation indicates no liquidity added (amounts too small).");
          }
        } catch (e: any) {
          setBusy(false);
          return addLog(`❌ Sim increase reverted: ${e?.shortMessage ?? e?.message ?? e}`);
        }

        addLog(`🧾 Increasing liquidity on tokenId=${tokenIdForIncrease}…`);
        const tx = await nfpm.increaseLiquidity(incParams);
        addLog(`🔄 increaseLiquidity tx: ${arbTx(tx.hash)}`);
        setLastTx(tx.hash);
        await tx.wait();
        addLog("✅ Liquidity increased.");
        setLastTokenId(String(tokenIdForIncrease));
        setMatchedTokenId(String(tokenIdForIncrease));
      } else {
        // MINT
        const { tickLower, tickUpper } = fullRange(tickSpacing);
        addLog(`ℹ️ Using full-range: [${tickLower}, ${tickUpper}] spacing=${tickSpacing}`);

        const mintParams = {
          token0: poolToken0,
          token1: poolToken1,
          fee: POOL_FEE,
          tickLower,
          tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: address,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
        } as const;

        try {
          const sim = await nfpm.mint.staticCall(mintParams, { value: 0n });
          const liq = sim[1] as bigint;
          if (liq === 0n) {
            setBusy(false);
            return addLog("❌ Simulation indicates zero liquidity (increase amount or narrow range).");
          }
        } catch (e: any) {
          setBusy(false);
          return addLog(`❌ Simulate mint reverted: ${e?.shortMessage ?? e?.message ?? e}`);
        }

        addLog("🧾 Minting new position…");
        const tx = await nfpm.mint(mintParams, { value: 0n });
        addLog(`🚀 mint tx: ${arbTx(tx.hash)}`);
        setLastTx(tx.hash);
        const rc = await tx.wait();
        addLog(`✅ Mint confirmed in block ${rc.blockNumber}.`);

        try {
          const tfLog = rc.logs.find(
            (l: any) => l.address.toLowerCase() === NFPM.toLowerCase() && l.topics?.[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
          );
          if (tfLog) {
            const tokenId = BigInt(tfLog.topics[3]).toString();
            setLastTokenId(tokenId);
            setMatchedTokenId(tokenId);
            addLog(`🆔 Position NFT tokenId = ${tokenId}`);
          }
        } catch {}
      }

      await refreshWalletState();
    } catch (e: any) {
      addLog(`❌ Supply failed: ${e?.shortMessage ?? e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, [
    provider,
    signer,
    address,
    onWrongChain,
    poolAddr,
    poolToken0,
    poolToken1,
    tickSpacing,
    poolFeeRead,
    POOL_FEE,
    amountEth,
    price,
    decWeth,
    decDefiD,
    WETH,
    DEFI_D,
    NFPM,
    matchedTokenId,
    findMatchingPositionNow,
    refreshWalletState,
    addLog,
  ]);

  // ---------- Load a position by id (+ claimables) — SILENT helper ----------
  const loadPositionById = useCallback(
    async (tokenId: string, log: boolean = false) => {
      if (!signer) return;
      try {
        const nfpm = rwContract(NFPM, [NFPM_POSITIONS_SIG, NFPM_COLLECT_SIG], signer);
        const pos = await nfpm.positions(tokenId);
        setLoadedPosition(pos);

        try {
          const colParams = {
            tokenId: BigInt(tokenId),
            recipient: address,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
          } as const;
          const sim = await nfpm.collect.staticCall(colParams);
          setClaimable0(sim[0] as bigint);
          setClaimable1(sim[1] as bigint);
          if (log) {
            addLog(
              `🧪 Claimable (simulated) → amount0=${(sim[0] as bigint).toString()} amount1=${(sim[1] as bigint).toString()}`
            );
          }
        } catch (e: any) {
          setClaimable0(null);
          setClaimable1(null);
          if (log) addLog(`⚠️ Sim collect (claimable) failed: ${e?.shortMessage ?? e?.message ?? e}`);
        }

        if (log) {
          addLog(
            `ℹ️ Position ${tokenId}:\n- token0=${pos.token0}\n- token1=${pos.token1}\n- fee=${Number(
              pos.fee
            )}\n- ticks=[${Number(pos.tickLower)}, ${Number(pos.tickUpper)}]\n- liquidity=${pos.liquidity.toString()}`
          );
        }
      } catch (e: any) {
        if (log) addLog(`❌ loadPosition failed: ${e?.shortMessage ?? e?.message ?? e}`);
      }
    },
    [signer, address, NFPM, addLog]
  );

  // ---------- Auto-detect (silent) ----------
  const detectAndLoadFirstPosition = useCallback(async () => {
    if (!signer || !address || !poolToken0 || !poolToken1 || poolFeeRead === null) return;
    try {
      const tid = await findMatchingPositionNow(poolToken0, poolToken1, Number(poolFeeRead));
      if (tid) {
        setMatchedTokenId(tid);
        setLastTokenId(tid);
        await loadPositionById(tid, false); // silent on mount
      } else {
        setMatchedTokenId(null);
        setLoadedPosition(null);
        setClaimable0(null);
        setClaimable1(null);
      }
    } catch {
      // silent
    }
  }, [signer, address, poolToken0, poolToken1, poolFeeRead, findMatchingPositionNow, loadPositionById]);

  useEffect(() => {
    if (!address) return;
    void detectAndLoadFirstPosition();
  }, [address, poolToken0, poolToken1, poolFeeRead, detectAndLoadFirstPosition]);

  // ---------- Auto-unwrap helper ----------
  const unwrapExactWeth = useCallback(
    async (amount: bigint) => {
      if (!signer) return;
      if (amount <= 0n) return;
      try {
        const weth = new ethers.Contract(WETH, ABIS?.WETH_ABI ?? WETH_ABI_FALLBACK, signer);
        const tx = await weth.withdraw(amount);
        addLog(`🔄 unwrap WETH→ETH tx: ${arbTx(tx.hash)} (amount=${ethers.formatUnits(amount, decWeth)} WETH)`);
        await tx.wait();
        addLog("✅ Unwrapped to ETH.");
      } catch (e: any) {
        addLog(`❌ unwrap failed: ${e?.shortMessage ?? e?.message ?? e}`);
      }
    },
    [signer, WETH, decWeth, addLog]
  );

  // ---------- Collect Fees only (logs enabled) ----------
  const collectFeesOnly = useCallback(async () => {
    if (!signer || !address) return addLog("❌ Connect your wallet first.");
    const tokenId = matchedTokenId || lastTokenId;
    if (!tokenId) return addLog("❌ No position detected.");

    setBusy(true);
    try {
      const nfpm = rwContract(NFPM, [NFPM_COLLECT_SIG, NFPM_POSITIONS_SIG], signer);
      const wethC = new ethers.Contract(WETH, ABIS?.WETH_ABI ?? WETH_ABI_FALLBACK, signer);

      // simulate (for logging)
      try {
        const paramsSim = {
          tokenId: BigInt(tokenId),
          recipient: address,
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        } as const;
        const sim = await nfpm.collect.staticCall(paramsSim);
        addLog(`🧪 Sim Collect → amount0=${(sim[0] as bigint).toString()} amount1=${(sim[1] as bigint).toString()}`);
      } catch (e: any) {
        addLog(`⚠️ Sim collect failed: ${e?.shortMessage ?? e?.message ?? e}`);
      }

      // measure WETH before
      const wethBefore: bigint = await wethC.balanceOf(address);

      // execute collect
      const params = {
        tokenId: BigInt(tokenId),
        recipient: address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      } as const;

      addLog("🧾 Collecting fees…");
      const tx = await nfpm.collect(params);
      addLog(`🔄 collect tx: ${arbTx(tx.hash)}`);
      const rc = await tx.wait();
      addLog("✅ Fees collected.");

      // measure WETH after and unwrap delta
      const wethAfter: bigint = await wethC.balanceOf(address);
      const wethDelta = wethAfter > wethBefore ? wethAfter - wethBefore : 0n;
      if (wethDelta > 0n) {
        addLog(`🤖 Auto-unwrapping collected WETH → ETH (delta=${ethers.formatUnits(wethDelta, decWeth)} WETH)…`);
        await unwrapExactWeth(wethDelta);
      } else {
        addLog("ℹ️ No new WETH detected to unwrap.");
      }

      await refreshWalletState();
      await loadPositionById(tokenId, true); // user action → allowed to log position/claimables
    } catch (e: any) {
      addLog(`❌ Collect failed: ${e?.shortMessage ?? e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, [
    signer,
    address,
    matchedTokenId,
    lastTokenId,
    NFPM,
    WETH,
    decWeth,
    refreshWalletState,
    loadPositionById,
    unwrapExactWeth,
    addLog,
  ]);

  // ---------- Full Exit (decrease 100%) + collect (logs enabled) ----------
  const withdrawAndCollectAll = useCallback(async () => {
    if (!signer || !address) return addLog("❌ Connect your wallet first.");
    const tokenId = matchedTokenId || lastTokenId;
    if (!tokenId) return addLog("❌ No position detected.");

    setBusy(true);
    try {
      const nfpm = rwContract(NFPM, [NFPM_POSITIONS_SIG, NFPM_DECREASE_SIG, NFPM_COLLECT_SIG], signer);
      const wethC = new ethers.Contract(WETH, ABIS?.WETH_ABI ?? WETH_ABI_FALLBACK, signer);

      // read liquidity
      const pos = await nfpm.positions(tokenId);
      const liq: bigint = BigInt(pos.liquidity);
      addLog(`ℹ️ Current liquidity: ${liq.toString()}`);

      // decrease 100%
      if (liq > 0n) {
        const decParams = {
          tokenId: BigInt(tokenId),
          liquidity: liq,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
        } as const;

        try {
          await nfpm.decreaseLiquidity.staticCall(decParams);
        } catch (e: any) {
          addLog(`⚠️ Sim decreaseLiquidity failed: ${e?.shortMessage ?? e?.message ?? e}`);
        }

        addLog("🧾 Decreasing liquidity (100%)…");
        const txDec = await nfpm.decreaseLiquidity(decParams);
        addLog(`🔄 decreaseLiquidity tx: ${arbTx(txDec.hash)}`);
        await txDec.wait();
        addLog("✅ Liquidity decreased.");
      } else {
        addLog("ℹ️ No liquidity to decrease (already 0).");
      }

      // measure WETH before collect
      const wethBefore: bigint = await wethC.balanceOf(address);

      // collect all
      const colParams = {
        tokenId: BigInt(tokenId),
        recipient: address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      } as const;
      addLog("🧾 Collecting…");
      const txCol = await nfpm.collect(colParams);
      addLog(`🔄 collect tx: ${arbTx(txCol.hash)}`);
      await txCol.wait();
      addLog("✅ Collect complete.");

      // unwrap any newly received WETH
      const wethAfter: bigint = await wethC.balanceOf(address);
      const wethDelta = wethAfter > wethBefore ? wethAfter - wethBefore : 0n;
      if (wethDelta > 0n) {
        addLog(`🤖 Auto-unwrapping WETH → ETH (delta=${ethers.formatUnits(wethDelta, decWeth)} WETH)…`);
        await unwrapExactWeth(wethDelta);
      } else {
        addLog("ℹ️ No new WETH detected to unwrap.");
      }

      await refreshWalletState();
      await loadPositionById(tokenId, true);
    } catch (e: any) {
      addLog(`❌ withdraw+collect failed: ${e?.shortMessage ?? e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, [
    signer,
    address,
    matchedTokenId,
    lastTokenId,
    NFPM,
    WETH,
    decWeth,
    refreshWalletState,
    loadPositionById,
    unwrapExactWeth,
    addLog,
  ]);

  // ---------- UI ----------
  const canSupply =
    ready && !onWrongChain && Number(amountEth) > 0 && price > 0 && Boolean(poolToken0 && poolToken1);
  const t0IsWeth = (poolToken0 || "").toLowerCase() === WETH.toLowerCase();
  const t1IsWeth = (poolToken1 || "").toLowerCase() === WETH.toLowerCase();

  // Derive nicely labeled claimables for UI (ETH / DeFiD regardless of order)
  const claimableETH = useMemo(() => {
    if (claimable0 === null || claimable1 === null) return null;
    const ethRaw = t0IsWeth ? claimable0 : t1IsWeth ? claimable1 : 0n;
    return ethers.formatUnits(ethRaw, decWeth);
  }, [claimable0, claimable1, t0IsWeth, t1IsWeth, decWeth]);

  const claimableDeFiD = useMemo(() => {
    if (claimable0 === null || claimable1 === null) return null;
    const defiRaw = t0IsWeth ? (claimable1 ?? 0n) : t1IsWeth ? (claimable0 ?? 0n) : (claimable0 ?? 0n);
    return ethers.formatUnits(defiRaw, decDefiD);
  }, [claimable0, claimable1, t0IsWeth, t1IsWeth, decDefiD]);

  return (
    <div style={{ border: "1px solid #e5e7eb", padding: 20, borderRadius: 12, maxWidth: 980, marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Add Liquidity (Full-Range, Auto-calc)</h3>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          Amount (ETH):&nbsp;
          <input
            type="number"
            value={amountEth}
            placeholder="e.g. 0.01"
            onChange={(e) => setAmountEth(e.target.value)}
            step="any"
            inputMode="decimal"
          />
        </label>

        <label>
          Required DeFiD (auto):&nbsp;
          <input type="text" value={amountDefiD} placeholder="auto" readOnly />
        </label>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        Buffer (+0.3%): {amountDefiDBuffer || "-"}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        {poolAddr ? (
          <>
            Active pool:{" "}
            <a href={arbAddr(poolAddr)} target="_blank" rel="noreferrer">
              {poolAddr}
            </a>
          </>
        ) : (
          <>Active pool: resolving…</>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <button onClick={loadOnchain} disabled={busy}>
          Reload price
        </button>
        {!price || price <= 0 ? (
          <span>Price: loading…</span>
        ) : (
          <span>Price: 1 ETH ≈ {formatAmount(price, 6)} DeFiD</span>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9 }}>
        {Number(amountEth) > 0 && price > 0 ? (
          <>
            Required (approx):&nbsp;<b>{formatAmount(amountEth, 8)} ETH</b> +{" "}
            <b>{formatAmount(Number(amountEth) * price, 6)} DeFiD</b>
          </>
        ) : (
          <>Enter ETH amount to see required DeFiD.</>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <button disabled={!canSupply || busy} style={{ padding: "8px 14px", borderRadius: 10 }} onClick={doSupply}>
          {busy
            ? "Supplying…"
            : matchedTokenId
            ? `Add to Existing Position (#${matchedTokenId})`
            : "Mint New Position"}
        </button>
      </div>

      {(lastTx || lastTokenId) && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {lastTx && (
            <div>
              Tx:{" "}
              <a href={arbTx(lastTx)} target="_blank" rel="noreferrer">
                {lastTx}
              </a>
            </div>
          )}
          {lastTokenId && (
            <div>
              Position:{" "}
              <a href={arbNft(NFPM, lastTokenId)} target="_blank" rel="noreferrer">
                NFT #{lastTokenId}
              </a>
            </div>
          )}
        </div>
      )}

      <hr style={{ margin: "16px 0" }} />

      {/* ========= My Position ========= */}
      <h3 style={{ marginTop: 0 }}>My Position</h3>
      {!matchedTokenId ? (
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          {ready ? "No matching position found for this pool." : "Connect your wallet to view your position."}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, fontSize: 12 }}>
            <div>
              <b>Token ID</b>
              <br />#{matchedTokenId}
            </div>
            <div>
              <b>Fee</b>
              <br />
              1%
            </div>
            <div>
              <b>Range</b>
              <br />
              [{loadedPosition ? Number(loadedPosition.tickLower) : "-"} ,{" "}
              {loadedPosition ? Number(loadedPosition.tickUpper) : "-"}]
            </div>
            <div>
              <b>Liquidity</b>
              <br />
              {loadedPosition ? String(loadedPosition.liquidity) : "-"}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
            <b>Claimable:</b>&nbsp;
            {claimableETH !== null && claimableDeFiD !== null ? (
              <>
                ETH = {formatAmount(claimableETH, 6)},&nbsp; DeFiD = {formatAmount(claimableDeFiD, 6)}
              </>
            ) : (
              <>-</>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button disabled={busy} onClick={() => matchedTokenId && loadPositionById(matchedTokenId, true)}>
              Refresh
            </button>
            <button disabled={busy || !matchedTokenId} onClick={collectFeesOnly}>
              Collect Fees
            </button>
            <button disabled={busy || !matchedTokenId} onClick={withdrawAndCollectAll}>
              Withdraw & Collect (All)
            </button>
          </div>
        </>
      )}

      <hr style={{ margin: "16px 0" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 12 }}>
        <div>ETH: {formatAmount(balEth, 6)}</div>
        <div>
          WETH: {formatAmount(balWeth, 6)} (allow: {formatAmount(allowWeth, 4)})
        </div>
        <div>
          DeFiD: {formatAmount(balDefiD, 6)} (allow: {formatAmount(allowDefiD, 4)})
        </div>
      </div>

      <textarea readOnly style={{ width: "100%", minHeight: 300, marginTop: 12 }} value={logs.join("\n")} />
    </div>
  );
};

export default Liquidity;
