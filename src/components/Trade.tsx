// src/components/Trade.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { formatUnits, parseUnits, getAddress } from 'viem'
import { ADDR, isEthMode } from '../config'
import { ERC20_ABI, SwapRouterABI, WETH_ABI, V3_POOL_ABI } from '../abi'

// ---- helpers ----
const Q96 = 2n ** 96n
const TIER_ORDER = [100, 500, 3000, 10000] as const // 0.01%, 0.05%, 0.3%, 1%

const now = () => new Date().toLocaleTimeString()
const bpsFromPercentStr = (p: string) => Math.floor(Math.max(0, Number((p || '0').trim())) * 100)
const applySlippageBps = (amount: bigint, bps: number) => amount - (amount * BigInt(bps)) / 10_000n

export default function Trade() {
  // wagmi
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  // vaste config uit ADDR (nooit undefined)
  const TOKEN0 = getAddress(ADDR.WETH) as `0x${string}`        // WETH (UI toont ETH in ETH-mode)
  const TOKEN1 = getAddress(ADDR.DEFI_D) as `0x${string}`      // DeFiD
  const DEFAULT_FEE = ADDR.POOL_FEE as 100 | 500 | 3000 | 10000
  const FACTORY = getAddress(ADDR.FACTORY) as `0x${string}`
  const ROUTER_02 = getAddress(ADDR.SWAP_ROUTER_02) as `0x${string}`

  // UI state
  const [direction, setDirection] = useState<'0to1' | '1to0'>('0to1')
  const [amountInStr, setAmountInStr] = useState('0.01')
  const [slippageStr, setSlippageStr] = useState('1') // %
  const [dec0, setDec0] = useState<number>(18)
  const [dec1, setDec1] = useState<number>(18)
  const [symbol0, setSymbol0] = useState<string>('WETH')
  const [symbol1, setSymbol1] = useState<string>('TOKEN1')

  const [quoteOut, setQuoteOut] = useState<string>('') // formatted
  const [minOut, setMinOut] = useState<string>('') // formatted (UI)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteNote, setQuoteNote] = useState<string>('')

  const [swapBusy, setSwapBusy] = useState(false)
  const [log, setLog] = useState<string>('')

  const append = (s: string) => setLog((p) => `${now()} — ${s}\n` + p)

  const displaySym0 = isEthMode() ? 'ETH' : symbol0
  const fromSym = direction === '0to1' ? displaySym0 : symbol1
  const toSym = direction === '0to1' ? symbol1 : displaySym0

  // ---- token metadata ----
  useEffect(() => {
    (async () => {
      if (!publicClient) return
      try {
        const [d0, d1, s0, s1] = await Promise.all([
          publicClient.readContract({ address: TOKEN0, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
          publicClient.readContract({ address: TOKEN1, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
          publicClient.readContract({ address: TOKEN0, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => 'WETH') as Promise<string>,
          publicClient.readContract({ address: TOKEN1, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
        ])
        setDec0(Number(d0)); setDec1(Number(d1))
        setSymbol0(s0); setSymbol1(s1)
      } catch (e: any) {
        append('Token metadata load failed: ' + (e?.message || e))
      }
    })()
  }, [publicClient, TOKEN0, TOKEN1])

  // ---- auto preview debounce ----
  const debounceRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!publicClient) return
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => { void preview() }, 350)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, direction, amountInStr, slippageStr, TOKEN0, TOKEN1, DEFAULT_FEE])

  // ---- pool resolver ----
  async function resolveActivePool(): Promise<{ pool:`0x${string}`, fee:number, sqrt:bigint } | null> {
    if (!publicClient) return null

    for (const fee of [DEFAULT_FEE, ...TIER_ORDER.filter(f=>f!==DEFAULT_FEE)]) {
      try {
        const pool = await publicClient.readContract({
          address: FACTORY,
          abi: [
            { inputs:[{name:'tokenA',type:'address'},{name:'tokenB',type:'address'},{name:'fee',type:'uint24'}],
              name:'getPool', outputs:[{type:'address'}], stateMutability:'view', type:'function' }
          ],
          functionName: 'getPool',
          args: [TOKEN0, TOKEN1, fee]
        }) as `0x${string}`

        if (!pool || pool === '0x0000000000000000000000000000000000000000') continue

        const slot0 = await publicClient.readContract({
          address: pool, abi: V3_POOL_ABI, functionName: 'slot0'
        }) as any

        const sqrt = BigInt(Array.isArray(slot0) ? slot0[0] : slot0.sqrtPriceX96)
        if (sqrt !== 0n) return { pool, fee, sqrt }
      } catch {}
    }
    return null
  }

  // ---- preview (API → fallback) ----
  async function preview() {
    try {
      setQuoteOut(''); setMinOut(''); setQuoteNote(''); setQuoteBusy(true)
      if (!publicClient) return

      const tokenIn  = direction === '0to1' ? TOKEN0 : TOKEN1
      const tokenOut = direction === '0to1' ? TOKEN1 : TOKEN0
      const decIn    = direction === '0to1' ? dec0 : dec1
      const decOut   = direction === '0to1' ? dec1 : dec0

      const amountIn = parseUnits((amountInStr || '0').trim() || '0', decIn)
      if (amountIn === 0n) { return }

      // 1) Sushi API try
      try {
        const url = new URL(`https://api.sushi.com/quote/v7/42161`)
        url.searchParams.set('tokenIn',  getAddress(tokenIn))
        url.searchParams.set('tokenOut', getAddress(tokenOut))
        url.searchParams.set('amount',   amountIn.toString())
        url.searchParams.set('maxSlippage', (Number(slippageStr || '1')/100).toString())

        const res = await fetch(url.toString())
        const txt = await res.text()
        let json: any = null
        try { json = JSON.parse(txt) } catch {}
        if (json?.status === 'Success' && json?.assumedAmountOut) {
          const out = formatUnits(BigInt(json.assumedAmountOut), decOut)
          setQuoteOut(out)
          const slip = Math.max(0, Number(slippageStr || '0')) / 100
          const minOutNum = Number(out || '0') * (1 - slip)
          setMinOut(minOutNum.toString())
          setQuoteNote('Quote via Sushi API.')
          return
        }
      } catch {}

      // 2) Fallback via slot0
      const active = await resolveActivePool()
      if (!active) {
        setQuoteNote('No active Sushi V3 pool found (all fee tiers returned 0).')
        return
      }

      const midPriceNum = Number((active.sqrt * active.sqrt) / (Q96 * Q96))
      const outEst = direction === '0to1'
        ? Number(formatUnits(amountIn, dec0)) * midPriceNum
        : Number(formatUnits(amountIn, dec1)) / (midPriceNum || 1)

      setQuoteOut(outEst.toString())
      const slip = Math.max(0, Number(slippageStr || '0')) / 100
      setMinOut((outEst * (1 - slip)).toString())
      setQuoteNote('Indicative quote (slot0 fallback).')
    } finally {
      setQuoteBusy(false)
    }
  }

  // ---- approvals & balances ----
  async function approveIfNeeded(token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`, amount: bigint) {
    if (!publicClient || !walletClient || !owner) return
    const allowance = await publicClient.readContract({
      address: token, abi: ERC20_ABI, functionName: 'allowance', args: [owner, spender]
    }) as bigint
    if (allowance < amount) {
      const hash = await walletClient.writeContract({
        address: token, abi: ERC20_ABI, functionName: 'approve', args: [spender, amount]
      })
      append(`Approve to ${spender.slice(0,6)}…${spender.slice(-4)}: ` + hash)
      await publicClient.waitForTransactionReceipt({ hash })
      append('Approve confirmed')
    }
  }
  async function wethBalance(owner: `0x${string}`) {
    if (!publicClient) return 0n
    return await publicClient.readContract({ address: TOKEN0, abi: WETH_ABI, functionName: 'balanceOf', args: [owner] }) as bigint
  }
  async function wrapEth(amount: bigint) {
    if (!walletClient || !publicClient) return
    const hash = await walletClient.writeContract({ address: TOKEN0, abi: WETH_ABI, functionName: 'deposit', args: [], value: amount })
    append('Wrapped ETH → WETH: ' + hash)
    await publicClient.waitForTransactionReceipt({ hash })
  }
  async function unwrapWeth(amount: bigint) {
    if (!walletClient || !publicClient) return
    if (amount <= 0n) return
    const hash = await walletClient.writeContract({ address: TOKEN0, abi: WETH_ABI, functionName: 'withdraw', args: [amount] })
    append('Unwrapped WETH → ETH: ' + hash)
    await publicClient.waitForTransactionReceipt({ hash })
  }

  // ---- SWAP (API → fallback A → fallback B) ----
  async function swap() {
    try {
      if (!walletClient || !publicClient || !address) { append('Connect your wallet first'); return }
      setSwapBusy(true)

      const tokenIn  = direction === '0to1' ? TOKEN0 : TOKEN1
      const tokenOut = direction === '0to1' ? TOKEN1 : TOKEN0
      const decIn  = direction === '0to1' ? dec0 : dec1
      const decOut = direction === '0to1' ? dec1 : dec0
      const amountIn = parseUnits((amountInStr || '0').trim() || '0', decIn)
      if (amountIn === 0n) { append('Amount must be > 0'); return }

      const active = await resolveActivePool()
      if (!active) { append('Swap blocked: no active pool/tier found.'); return }

      // minOut (BigInt) uit UI-quote + slippage in bps
      if (!quoteOut) await preview()
      const outUi = quoteOut ? parseUnits(quoteOut, decOut) : 0n
      const bps = bpsFromPercentStr(slippageStr)
      let minOutWei = applySlippageBps(outUi, bps)
      if (minOutWei > outUi) minOutWei = outUi

      // Bepaal één keer, hergebruik later: GEEN dubbele declaraties meer
      const zeroToOneEth = isEthMode() && direction === '0to1'
      const oneToZeroEth = isEthMode() && direction === '1to0'

      const wethBefore = await wethBalance(address as `0x${string}`)

      // ===== 1) Sushi API route =====
      let usedApiRoute = false
      try {
        const url = new URL(`https://api.sushi.com/swap/v7/42161`)
        url.searchParams.set('tokenIn',  getAddress(tokenIn))
        url.searchParams.set('tokenOut', getAddress(tokenOut))
        url.searchParams.set('amount',   amountIn.toString())
        url.searchParams.set('maxSlippage', (Number(slippageStr || '1')/100).toString())
        url.searchParams.set('sender', address!)

        const res = await fetch(url.toString())
        const txt = await res.text()
        let json: any = null
        try { json = JSON.parse(txt) } catch {}

        if (json?.status === 'Success' && json?.tx) {
          const apiSpender = getAddress(json.tx.to) as `0x${string}`
          const apiValue = json.tx.value ? BigInt(json.tx.value) : 0n

          if (zeroToOneEth) {
            if (apiValue === 0n) {
              append('[API] No value in tx for ETH→token. Pre-wrapping to WETH and approving spender…')
              await wrapEth(amountIn)
              await approveIfNeeded(tokenIn, address as `0x${string}`, apiSpender, amountIn)
            }
          } else {
            await approveIfNeeded(tokenIn, address as `0x${string}`, apiSpender, amountIn)
          }

          try {
            await publicClient.call({
              to: apiSpender,
              data: json.tx.data as `0x${string}`,
              account: address as `0x${string}`,
              value: apiValue
            })
          } catch (simErr:any) {
            append('[Swap/API simulate] revert: ' + (simErr?.shortMessage || simErr?.message || String(simErr)))
            throw new Error('API simulate revert')
          }

          const hash = await walletClient.sendTransaction({
            to: apiSpender,
            data: json.tx.data as `0x${string}`,
            value: apiValue
          })
          append('Swap (API route) sent: ' + hash)
          await publicClient.waitForTransactionReceipt({ hash })
          append('Swap confirmed via Sushi API route')
          usedApiRoute = true
        }
      } catch (e:any) {
        append('[Swap API] error: ' + (e?.shortMessage || e?.message || String(e)))
      }

      // ===== 2) Fallback A: native ETH (value) → Router exactInputSingle =====
      let usedFallbackA = false
      if (!usedApiRoute) {
        try {
          if (!zeroToOneEth) {
            await approveIfNeeded(tokenIn, address as `0x${string}`, ROUTER_02, amountIn)
          }

          const deadline = BigInt(Math.floor(Date.now()/1000) + 60 * 20)

          let minForTx = minOutWei
          try {
            await publicClient.simulateContract({
              address: ROUTER_02,
              abi: SwapRouterABI,
              functionName: 'exactInputSingle',
              args: [{
                tokenIn, tokenOut, fee: active.fee, recipient: address!, deadline,
                amountIn, amountOutMinimum: minForTx, sqrtPriceLimitX96: 0n
              }],
              account: address as `0x${string}`,
              value: zeroToOneEth ? amountIn : 0n
            })
          } catch (simErr:any) {
            append('[Fallback A simulate] revert (with minOut): ' + (simErr?.shortMessage || simErr?.message || String(simErr)))
            minForTx = 0n
            await publicClient.simulateContract({
              address: ROUTER_02,
              abi: SwapRouterABI,
              functionName: 'exactInputSingle',
              args: [{
                tokenIn, tokenOut, fee: active.fee, recipient: address!, deadline,
                amountIn, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
              }],
              account: address as `0x${string}`,
              value: zeroToOneEth ? amountIn : 0n
            })
          }

          const hashSwap = await walletClient.writeContract({
            address: ROUTER_02,
            abi: SwapRouterABI,
            functionName: 'exactInputSingle',
            args: [{
              tokenIn, tokenOut, fee: active.fee, recipient: address!, deadline,
              amountIn, amountOutMinimum: minForTx, sqrtPriceLimitX96: 0n
            }],
            value: zeroToOneEth ? amountIn : 0n
          })
          append('Swap (fallback A) tx sent: ' + hashSwap)
          await publicClient.waitForTransactionReceipt({ hash: hashSwap })
          append('Swap confirmed (fallback A)')
          usedFallbackA = true
        } catch (e:any) {
          append('Fallback A failed: ' + (e?.shortMessage || e?.message || String(e)))
        }
      }

      // ===== 3) Fallback B: pre-wrap + approve + exactInputSingle zonder value =====
      if (!usedApiRoute && !usedFallbackA && zeroToOneEth) {
        try {
          append('[Fallback B] Pre-wrap ETH→WETH and approve router…')
          await wrapEth(amountIn)
          await approveIfNeeded(tokenIn, address as `0x${string}`, ROUTER_02, amountIn)

          const deadline = BigInt(Math.floor(Date.now()/1000) + 60 * 20)

          let minForTx = minOutWei
          try {
            await publicClient.simulateContract({
              address: ROUTER_02,
              abi: SwapRouterABI,
              functionName: 'exactInputSingle',
              args: [{
                tokenIn, tokenOut, fee: active.fee, recipient: address!, deadline,
                amountIn, amountOutMinimum: minForTx, sqrtPriceLimitX96: 0n
              }],
              account: address as `0x${string}`,
              value: 0n
            })
          } catch {
            minForTx = 0n
            await publicClient.simulateContract({
              address: ROUTER_02,
              abi: SwapRouterABI,
              functionName: 'exactInputSingle',
              args: [{
                tokenIn, tokenOut, fee: active.fee, recipient: address!, deadline,
                amountIn, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
              }],
              account: address as `0x${string}`,
              value: 0n
            })
          }

          const hashSwap = await walletClient.writeContract({
            address: ROUTER_02,
            abi: SwapRouterABI,
            functionName: 'exactInputSingle',
            args: [{
              tokenIn, tokenOut, fee: active.fee, recipient: address!, deadline,
              amountIn, amountOutMinimum: minForTx, sqrtPriceLimitX96: 0n
            }],
            value: 0n
          })
          append('Swap (fallback B) tx sent: ' + hashSwap)
          await publicClient.waitForTransactionReceipt({ hash: hashSwap })
          append('Swap confirmed (fallback B)')
        } catch (e:any) {
          append('Fallback B failed: ' + (e?.shortMessage || e?.message || String(e)))
        }
      }

      // Auto-unwrap nétto WETH op token→ETH (géén her-declaratie!)
      if (oneToZeroEth) {
        const wethAfter = await wethBalance(address as `0x${string}`)
        const delta = wethAfter - wethBefore
        if (delta > 0n) await unwrapWeth(delta)
      }
    } catch (e: any) {
      append('Swap failed: ' + (e?.shortMessage || e?.message || String(e)))
    } finally {
      setSwapBusy(false)
    }
  }

  // ---- UI ----
  return (
    <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:16, marginTop:16}}>
      <h3 style={{marginTop:0}}>Trade</h3>

      <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
        <label>
          Direction:&nbsp;
          <select value={direction} onChange={e=>setDirection(e.target.value as any)}>
            <option value="0to1">ETH → DeFiD</option>
            <option value="1to0">DeFiD → ETH</option>
          </select>
        </label>

        <label>Amount in ({fromSym}): <input value={amountInStr} onChange={e=>setAmountInStr(e.target.value)} style={{width:120}} /></label>
        <label>Slippage %: <input value={slippageStr} onChange={e=>setSlippageStr(e.target.value)} style={{width:80}} /></label>

        <button onClick={preview} disabled={quoteBusy} style={{padding:'6px 12px', borderRadius:8}}>Preview</button>
        <button onClick={swap} disabled={swapBusy} style={{padding:'6px 12px', borderRadius:8}}>Swap</button>
      </div>

      {/* Quote panel */}
      <div style={{marginTop:8, fontSize:14}}>
        {quoteBusy && <span>Quoting…</span>}
        {!quoteBusy && quoteOut && (
          <>
            <div>Quote: ≈ <b>{quoteOut}</b> {toSym}</div>
            {minOut && <div>Min received (slippage {slippageStr}%): <b>{minOut}</b> {toSym}</div>}
            {quoteNote && <div style={{opacity:.7}}>{quoteNote}</div>}
          </>
        )}
        {!quoteBusy && !quoteOut && quoteNote && <div style={{color:'#b45309'}}>{quoteNote}</div>}
      </div>

      <textarea value={log} readOnly style={{width:'100%', minHeight:140, marginTop:12}} />
      <div style={{opacity:.7, fontSize:12, marginTop:4}}>
        Router: {ROUTER_02} · QuoterV2: {ADDR.QUOTER_V2}
      </div>
    </div>
  )
}
