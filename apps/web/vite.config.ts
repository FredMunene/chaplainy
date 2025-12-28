import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'solana-optional-peer-dep-stub',
      resolveId(id) {
        if (id === '__vite-optional-peer-dep:@solana-program/system:@privy-io/react-auth:false') {
          return '\0solana-system-stub'
        }
        return null
      },
      load(id) {
        if (id === '\0solana-system-stub') {
          return 'export function getTransferSolInstruction(){throw new Error("Solana support is not configured for this app.")}'
        }
        return null
      },
    },
  ],
})
