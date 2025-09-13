import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { http } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'

// 1) Chains als tuple
const chains = [arbitrum] as const

// 2) Transport: dev → Alchemy, prod/preview → proxy
const transport = import.meta.env.DEV
  ? http(`https://arb-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`)
  : http('/api/rpc')

// 3) WalletConnect project id
const projectId = import.meta.env.VITE_WALLETCONNECT_ID
if (!projectId) {
  console.warn('VITE_WALLETCONNECT_ID ontbreekt — zet deze in .env(.local) en in Vercel (Preview + Production).')
}

// 4) Optionele metadata
const metadata = {
  name: 'UluwatuSwap',
  description: 'Simple Sushi v3 swap + liquidity on Arbitrum',
  url: 'https://example.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886?s=200&v=4']
}

// 5) Wagmi-config met custom transport
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId: projectId || 'missing-project-id',
  metadata,
  transports: {
    [arbitrum.id]: transport
  }
})

// 6) Init Web3Modal — LET OP: géén "chains" key hier
createWeb3Modal({
  wagmiConfig,
  projectId: projectId || 'missing-project-id',
  enableAnalytics: false
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
