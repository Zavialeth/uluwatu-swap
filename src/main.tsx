// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// wagmi + web3modal
import { WagmiConfig, createConfig, http } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { createWeb3Modal } from '@web3modal/wagmi/react'

// TanStack Query (voor wagmi)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---- ENV (safe) ----
const projectId = (import.meta.env.VITE_WALLETCONNECT_ID as string) || ''
const rpcArb = (import.meta.env.VITE_ARBITRUM_RPC as string) || 'https://arb1.arbitrum.io/rpc'

// ---- Metadata voor WalletConnect (let op: URL dynamisch) ----
const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:'
const metadata = {
  name: 'UluwatuSwap V3 mini DEX',
  description: 'DeFiD/ETH (Arbitrum) mini UI',
  url: typeof window !== 'undefined'
    ? (isProd ? window.location.origin.replace('http:', 'https:') : window.location.origin)
    : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

// ---- Wagmi config met expliciete connectors & autoConnect ----
const chains = [arbitrum]
const wagmiConfig = createConfig({
  chains,
  transports: {
    [arbitrum.id]: http(rpcArb)
  },
  connectors: [
    injected({ shimDisconnect: true }), // beter reconnect gedrag bij MetaMask
    ...(projectId ? [walletConnect({ projectId, showQrModal: false, metadata })] : [])
  ],
  ssr: false,
  autoConnect: true
})

// ---- Web3Modal singleton init (fix voor HMR/StrictMode) ----
declare global {
  interface Window {
    __W3M_INITED__?: boolean
  }
}
if (projectId && !window.__W3M_INITED__) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    chains
    // -> Optional: themeMode: 'dark', themeVariables: { '--w3m-z-index': 2147483647 }
  })
  window.__W3M_INITED__ = true
} else if (!projectId) {
  console.warn('VITE_WALLETCONNECT_ID ontbreekt. Connect-modal werkt beperkt in dev.')
}

// ---- Query Client ----
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <App />
      </WagmiConfig>
    </QueryClientProvider>
  </React.StrictMode>
)
