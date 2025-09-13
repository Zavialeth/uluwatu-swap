import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // let op: geen .tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { WagmiProvider } from 'wagmi'
import { http } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'

// ---------- Chains ----------
const chains = [arbitrum]

// ---------- RPC transport ----------
// In development: direct naar Alchemy (VITE_ALCHEMY_API_KEY uit .env.local)
// In productie/preview: via jouw serverless proxy op Vercel (/api/rpc)
const transport = import.meta.env.DEV
  ? http(`https://arb-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`)
  : http('/api/rpc')

// ---------- WalletConnect / Web3Modal ----------
const projectId = import.meta.env.VITE_WALLETCONNECT_ID
if (!projectId) {
  console.warn(
    'VITE_WALLETCONNECT_ID ontbreekt — zet deze in .env(.local) voor lokaal en in Vercel → Environment Variables (Preview + Production).'
  )
}

// Metadata (optioneel, wordt soms door wallets getoond)
const metadata = {
  name: 'UluwatuSwap',
  description: 'Simple Sushi v3 swap + liquidity on Arbitrum',
  url: 'https://example.com', // zet hier gerust je Vercel URL neer
  icons: ['https://avatars.githubusercontent.com/u/37784886?s=200&v=4']
}

// Maak Wagmi-config die door Web3Modal wordt gebruikt
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId: projectId || 'missing-project-id',
  metadata,
  transports: {
    [arbitrum.id]: transport
  }
})

// Heel belangrijk: initialiseer de modal **voordat** <App /> of useWeb3Modal wordt gebruikt
createWeb3Modal({
  wagmiConfig,
  projectId: projectId || 'missing-project-id',
  chains,
  enableAnalytics: false // optioneel
})

// React Query client
const queryClient = new QueryClient()

// Render tree
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
