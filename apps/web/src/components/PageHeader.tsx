import { usePrivy } from '@privy-io/react-auth'
import { useKRNL } from '@krnl-dev/sdk-react-7702'
import { isKrnlConfigured } from '../krnlConfig'

type PageHeaderProps = {
  title: string
  subtitle: string
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  const { authenticated, login, logout, user } = usePrivy()
  const { embeddedWallet } = useKRNL()

  const walletAddress =
    embeddedWallet?.address ??
    (user as { wallet?: { address?: string } } | undefined)?.wallet?.address ??
    ''

  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Chaplain</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="toolbar">
        {authenticated ? (
          <>
            <span className="wallet">{walletAddress || 'Wallet connected'}</span>
            {!embeddedWallet && <span className="status">KRNL wallet not ready</span>}
            <button className="ghost" onClick={logout}>
              Disconnect
            </button>
          </>
        ) : (
          <button className="ghost" onClick={login}>
            Connect wallet
          </button>
        )}
      </div>
      {!isKrnlConfigured && (
        <div className="banner">
          Set `VITE_PRIVY_APP_ID`, `VITE_KRNL_NODE_URL`, and
          `VITE_KRNL_DELEGATED_CONTRACT` in `apps/web/.env` to enable KRNL.
        </div>
      )}
    </header>
  )
}
