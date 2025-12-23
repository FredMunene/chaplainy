import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { KRNLProvider } from '@krnl-dev/sdk-react-7702'
import './index.css'
import App from './App.tsx'
import { isKrnlConfigured, krnlConfig, privyAppId } from './krnlConfig'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

if (!isKrnlConfigured || !krnlConfig || !privyAppId) {
  throw new Error('KRNL and Privy configuration is required.')
}

const app = (
  <PrivyProvider appId={privyAppId}>
    <KRNLProvider config={krnlConfig}>
      <App />
    </KRNLProvider>
  </PrivyProvider>
)

createRoot(root).render(<StrictMode>{app}</StrictMode>)
