import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Wagmi + chains
import { createConfig, http, WagmiProvider } from 'wagmi'
import { arbitrum } from 'wagmi/chains'

// React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Web3Modal (optioneel als je gebruikt)
import { createWeb3Modal } from '@web3modal/wagmi/react'

// --- RPC configuratie ---
function makeDevRpcUrl() {
  // 1) Voorkeur: key uit .env.local
  const key = import.meta.env.VITE_ALCHEMY_API_KEY?.trim()
  if (key) {
    return `https://arb-mainnet.g.alchemy.com/v2/${key}`
  }

  // 2) Fallback: complete RPC uit VITE_ARBITRUM_RPC
  const direct = import.meta.env.VITE_ARBITRUM_RPC?.trim()
  if (direct) return direct

  console.error(
    '[Wagmi] Geen dev RPC gevonden. Zet VITE_ALCHEMY_API_KEY in .env.local of VITE_ARBITRUM_RPC in .env.local/.env.'
  )
  return 'http://localhost:8545' // laatste redmiddel
}

const rpcUrl = import.meta.env.PROD ? '/api/rpc' : makeDevRpcUrl()

// Wagmi config
export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(rpcUrl),
  },
  ssr: false,
})

// React Query client (één instance)
const queryClient = new QueryClient()

// Web3Modal (alleen als jij een projectId hebt ingesteld in je env)
const projectId = import.meta.env.VITE_WALLETCONNECT_ID
if (projectId) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    chains: [arbitrum],
    themeMode: 'dark',
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
