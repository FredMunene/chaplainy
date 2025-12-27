import { createConfig } from '@krnl-dev/sdk-react-7702'
import { sepolia } from 'viem/chains'

export const privyAppId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined
export const krnlNodeUrl = import.meta.env.VITE_KRNL_NODE_URL as string | undefined
export const delegatedContractAddress = import.meta.env
  .VITE_KRNL_DELEGATED_CONTRACT as string | undefined

export const isKrnlConfigured = Boolean(
  privyAppId && krnlNodeUrl && delegatedContractAddress,
)

export const krnlConfig = isKrnlConfigured
  ? createConfig({
      chain: sepolia,
      delegatedContractAddress,
      privyAppId,
      krnlNodeUrl,
    })
  : null
