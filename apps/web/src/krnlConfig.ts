import { createConfig } from '@krnl-dev/sdk-react-7702'
import { sepolia } from 'viem/chains'

export const privyAppId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined
export const krnlNodeUrl = import.meta.env.VITE_KRNL_NODE_URL as string | undefined
export const delegatedContractAddress = import.meta.env
  .VITE_KRNL_DELEGATED_CONTRACT as string | undefined

export const isKrnlConfigured = Boolean(
  privyAppId && krnlNodeUrl && delegatedContractAddress,
)

const rpcUrl = import.meta.env.SEPOLIA_RPC_URL as string | undefined

export const krnlConfig = isKrnlConfigured
  ? createConfig({
      chain: sepolia,
      delegatedContractAddress: delegatedContractAddress!,
      privyAppId: privyAppId!,
      krnlNodeUrl: krnlNodeUrl!,
      rpcUrl: rpcUrl || 'https://sepolia.infura.io/v3/f46c7003bea344bea572a8df43cd27fd',
    })
  : null
