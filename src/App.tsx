// src/App.tsx
import React, { useEffect, useMemo, useState } from 'react'
import Trade from './components/Trade'
import Liquidity from './components/Liquidity'
import { useAccount, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'

type TabKey = 'trade' | 'liquidity'

export default function App() {
  // Theme toggle
  const getInitialTheme = () => {
    const saved = localStorage.getItem('ulu-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme())
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ulu-theme', theme)
  }, [theme])

  const [tab, setTab] = useState<TabKey>('trade')
  const onSwitch = (key: TabKey) => setTab(key)
  const isDark = theme === 'dark'

  // Wallet state
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useWeb3Modal()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // Chain-namen
  const chainNameMap: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    56: 'BNB Chain',
    137: 'Polygon',
    42161: 'Arbitrum',
    43114: 'Avalanche',
    8453: 'Base'
  }
  const chainName = chainId ? (chainNameMap[chainId] || `Chain ${chainId}`) : 'Unknown Network'
  const onArbitrum = chainId === 42161

  // Live native balance
  const { data: balanceData } = useBalance({
    address,
    watch: true,
    enabled: Boolean(address)
  })
  const ethDisplay =
    balanceData?.formatted
      ? `${Number(balanceData.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${balanceData.symbol}`
      : ''

  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="ulu-root">
      <style>{css}</style>

      {/* Sticky header */}
      <header className="ulu-header">
        <div className="ulu-container ulu-header-row">
          {/* Brand */}
          <div className="ulu-brand">
            <span className="ulu-logo">🌀</span>
            <span className="ulu-title">UluwatuSwap</span>
            <span className="ulu-sub">V3 mini DEX</span>
          </div>

          {/* Tabs */}
          <nav className="ulu-tabs" role="tablist" aria-label="Main tabs">
            <button
              role="tab"
              aria-selected={tab === 'trade'}
              className={`ulu-tab ${tab === 'trade' ? 'is-active' : ''}`}
              onClick={() => onSwitch('trade')}
            >
              Trade
            </button>
            <button
              role="tab"
              aria-selected={tab === 'liquidity'}
              className={`ulu-tab ${tab === 'liquidity' ? 'is-active' : ''}`}
              onClick={() => onSwitch('liquidity')}
            >
              Pool
            </button>
          </nav>

          {/* Actions: theme + connect wallet + chain badge */}
          <div className="ulu-actions">
            <button
              className="ulu-theme"
              aria-label="Toggle theme"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {!isConnected ? (
              <button className="ulu-connect" onClick={() => open()}>
                Connect Wallet
              </button>
            ) : (
              <div className="ulu-wallet">
                <div className="ulu-wallet-row">
                  <span className="ulu-wallet-address">
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                  <button className="ulu-disconnect" title="Disconnect" onClick={() => disconnect()}>
                    ✕
                  </button>
                </div>
                <div className="ulu-wallet-meta">
                  <span className={`ulu-chip ${onArbitrum ? 'ulu-chip-ok' : 'ulu-chip-warn'}`}>{chainName}</span>
                  {ethDisplay && <span className="ulu-chip">{ethDisplay}</span>}
                  {!onArbitrum && (
                    <button
                      className="ulu-chip-action"
                      disabled={isSwitching}
                      onClick={() => switchChain?.({ chainId: 42161 })}
                      title="Switch to Arbitrum"
                    >
                      {isSwitching ? 'Switching…' : 'Switch → Arbitrum'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content (flex: 1 keeps footer at bottom) */}
      <main className="ulu-container ulu-main">
        {/* Trade panel wrapper: net niet in het midden */}
        <section role="tabpanel" className="ulu-panel" style={{ display: tab === 'trade' ? 'block' : 'none' }}>
          <div className="ulu-trade-wrap">
            <Trade />
          </div>
        </section>

        <section role="tabpanel" className="ulu-panel" style={{ display: tab === 'liquidity' ? 'block' : 'none' }}>
          <Liquidity />
        </section>
      </main>

      {/* Sticky footer at bottom */}
      <footer className="ulu-footer">
        <div className="ulu-container ulu-footer-row">
          <div>© {year} UluwatuSwap</div>
          <div className="ulu-meta">
            <span>Made for Degens</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ---- CSS ---- */
const css = `
:root {
  --bg: #0b0e13;
  --bg-soft: #11151d;
  --card: #121723;
  --text: #e9ecf1;
  --muted: #aab2c5;
  --brand: #6ee7ff;
  --brand-2: #7c3aed;
  --border: #1e2634;
  --ring: rgba(110, 231, 255, 0.35);
  --shadow: 0 8px 30px rgba(0,0,0,.25);
  --log-bg: #1a1d23;
  --log-border: #2a2e36;
  --log-text: #ffffff;
  --chip-ok: #1b5e20;
  --chip-warn: #7a271a;
}

:root[data-theme="light"] {
  --bg: #f7f8fb;
  --bg-soft: #ffffff;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #475569;
  --brand: #0ea5e9;
  --brand-2: #7c3aed;
  --border: #e5e7eb;
  --ring: rgba(14,165,233,.18);
  --shadow: 0 10px 30px rgba(2, 8, 23, .06);
  --log-bg: #f1f5f9;
  --log-border: #d0d5db;
  --log-text: #111827;
  --chip-ok: #e8faf0;
  --chip-warn: #fff1ee;
}

/* Layout to stick footer to bottom */
html, body, #root { height: 100%; }
body { margin: 0; }
.ulu-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(1200px 800px at 10% -10%, rgba(124, 58, 237, .15), transparent),
              radial-gradient(800px 600px at 90% -20%, rgba(110, 231, 255, .12), transparent),
              var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
}
.ulu-container { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
.ulu-main { padding: 24px 16px 48px; flex: 1; }

.ulu-header {
  position: sticky; top: 0; z-index: 40;
  backdrop-filter: blur(10px);
  background: color-mix(in oklab, var(--bg-soft) 82%, transparent);
  border-bottom: 1px solid var(--border);
}
.ulu-header-row {
  display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
  padding: 12px 16px;
}

.ulu-brand { display:flex; align-items:center; gap:10px; min-width: 0; }
.ulu-logo { font-size: 20px; }
.ulu-title { font-weight: 700; }
.ulu-sub { opacity: .6; margin-left: 8px; font-size: 13px; white-space: nowrap; }

.ulu-tabs { display:flex; gap: 6px; background: var(--bg-soft); padding: 6px; border-radius: 12px; border: 1px solid var(--border); }
.ulu-tab {
  background: transparent;
  color: var(--muted);
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.ulu-tab.is-active {
  color: var(--text);
  background: linear-gradient(180deg, color-mix(in oklab, var(--brand) 20%, transparent), transparent);
  outline: 1px solid color-mix(in oklab, var(--brand) 28%, var(--border));
}

.ulu-actions { display:flex; align-items:center; gap:10px; }

/* Theme button */
.ulu-theme {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}
.ulu-theme:hover { border-color: color-mix(in oklab, var(--brand) 55%, var(--border)); }

/* Connect wallet button */
.ulu-connect {
  background: var(--brand);
  color: #000;
  font-weight: 600;
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
.ulu-connect:hover { opacity: 0.85; }

/* Wallet connected state */
.ulu-wallet {
  display: grid;
  grid-auto-flow: row;
  gap: 6px;
  background: var(--bg-soft);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.ulu-wallet-row {
  display: flex; align-items: center; gap: 8px;
}
.ulu-wallet-address {
  font-size: 14px;
  font-weight: 700;
}
.ulu-disconnect {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
}
.ulu-disconnect:hover { color: var(--brand); }
.ulu-wallet-meta {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.ulu-chip {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  background: #1b2230;
  border: 1px solid var(--border);
  padding: 4px 8px;
  border-radius: 999px;
}
.ulu-chip-ok {
  background: color-mix(in oklab, var(--chip-ok) 50%, #1b2230);
  border-color: color-mix(in oklab, var(--chip-ok) 40%, var(--border));
}
.ulu-chip-warn {
  background: color-mix(in oklab, var(--chip-warn) 45%, #2a1f1d);
  border-color: color-mix(in oklab, var(--chip-warn) 40%, var(--border));
}
.ulu-chip-action {
  font-size: 12px;
  font-weight: 800;
  color: #02131c;
  background: var(--brand);
  border: 1px solid color-mix(in oklab, var(--brand) 40%, black);
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.ulu-chip-action:disabled {
  opacity: .6; cursor: not-allowed;
}

/* Panels inherit card polish and prevent child bleed */
.ulu-panel > div {
  border-color: var(--border) !important;
  background: var(--card);
  box-shadow: var(--shadow);
  border-radius: 12px !important;
  overflow: hidden; /* clip eventuele 1px overflow van children */
}

/* Trade page wrapper:
   - Horizontaal centreren
   - Verticale top-margin "net niet in het midden" */
.ulu-trade-wrap {
  display: flex;
  justify-content: center;
  margin-top: clamp(28px, 12vh, 140px);
}

/* Log textarea (perfect passend binnen panel) */
textarea[readonly], textarea[readOnly] {
  background: var(--log-bg) !important;
  color: var(--log-text) !important;
  border: 1px solid var(--log-border) !important;
  font-family: monospace;
  padding: 8px;
  line-height: 1.35;
  font-size: 13px;
  border-radius: 8px;
  resize: vertical;
  min-height: 120px;

  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;  /* respecteert eigen border/padding */
  margin-right: 0;
}

/* Footer stays at bottom thanks to flex layout */
.ulu-footer {
  border-top: 1px solid var(--border);
  background: color-mix(in oklab, var(--bg-soft) 88%, transparent);
}
.ulu-footer-row {
  display:flex; justify-content: space-between; align-items:center;
  padding: 14px 16px; font-size: 13px; color: var(--muted);
}

/* Small screens */
@media (max-width: 640px) {
  .ulu-header-row { grid-template-columns: 1fr; gap: 8px; }
  .ulu-tabs { justify-content: space-between; }
  .ulu-sub { display: none; }
  .ulu-trade-wrap { margin-top: clamp(18px, 10vh, 100px); }
}
`
