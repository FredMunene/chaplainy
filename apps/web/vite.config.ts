import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^__vite-optional-peer-dep:@solana-program\/system:@privy-io\/react-auth:false$/,
        replacement: fileURLToPath(new URL('./src/solanaSystemStub.ts', import.meta.url)),
      },
    ],
  },
})
