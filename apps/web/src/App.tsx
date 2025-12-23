import { useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useKRNL } from '@krnl-dev/sdk-react-7702'
import './App.css'
import { isKrnlConfigured } from './krnlConfig'
import { supabase } from './supabaseClient'

type SessionDraft = {
  title: string
  count: number
  category: number
  difficulty: 'easy' | 'medium' | 'hard'
  type: 'boolean' | 'multiple'
}

type CreatedSession = SessionDraft & {
  id: string
  createdAt: string
}

const defaultDraft: SessionDraft = {
  title: 'Chaplain Quick Quiz',
  count: 10,
  category: 20,
  difficulty: 'easy',
  type: 'boolean',
}

function App() {
  const [draft, setDraft] = useState<SessionDraft>(defaultDraft)
  const [session, setSession] = useState<CreatedSession | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const isReady = isKrnlConfigured
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { isAuthorized, enableSmartAccount, executeWorkflowFromTemplate } = useKRNL()

  const sessionLink = useMemo(() => {
    if (!session) return ''
    return `${window.location.origin}/session/${session.id}`
  }, [session])

  const walletAddress = useMemo(() => {
    const account = user as
      | { wallet?: { address?: string }; linkedAccounts?: Array<{ type?: string; address?: string }> }
      | undefined
    return (
      account?.wallet?.address ??
      account?.linkedAccounts?.find((item) => item.type === 'wallet')?.address ??
      ''
    )
  }, [user])

  const updateDraft = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const createSession = async () => {
    setError('')

    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    if (!ready) {
      setError('Wallet is still loading. Try again in a moment.')
      return
    }

    if (!authenticated) {
      setError('Connect your wallet to create a lobby.')
      return
    }

    if (!walletAddress) {
      setError('No wallet address found in session.')
      return
    }

    setIsCreating(true)
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 84532)

    const { error: insertError } = await supabase.from('sessions').insert({
      id,
      host_wallet: walletAddress,
      title: draft.title,
      source: 'opentdb',
      status: 'draft',
      entry_cap: null,
      prize_pool_wei: null,
      chain_id: chainId,
      created_at: createdAt,
    })

    if (insertError) {
      setError(insertError.message)
      setIsCreating(false)
      return
    }

    if (!isAuthorized) {
      try {
        await enableSmartAccount()
      } catch (err) {
        setError('Failed to authorize KRNL smart account.')
        setIsCreating(false)
        return
      }
    }

    if (executeWorkflowFromTemplate) {
      const template = {
        action: 'quiz_fetch',
        params: {
          sessionId: '{{SESSION_ID}}',
          count: '{{COUNT}}',
          category: '{{CATEGORY}}',
          difficulty: '{{DIFFICULTY}}',
          type: '{{TYPE}}',
        },
      }
      const params = {
        '{{SESSION_ID}}': id,
        '{{COUNT}}': String(draft.count),
        '{{CATEGORY}}': String(draft.category),
        '{{DIFFICULTY}}': draft.difficulty,
        '{{TYPE}}': draft.type,
      }
      try {
        await executeWorkflowFromTemplate(template, params)
      } catch (err) {
        setError('KRNL workflow failed to start.')
        setIsCreating(false)
        return
      }
    } else {
      setError('KRNL workflow executor is unavailable.')
      setIsCreating(false)
      return
    }

    setSession({
      ...draft,
      id,
      createdAt,
    })
    setIsCreating(false)
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Chaplain</p>
          <h1>Host a verified quiz session</h1>
          <p className="subtitle">
            Create a lobby, fetch questions from Open Trivia DB, and verify answers
            with KRNL attestations.
          </p>
        </div>
        <div className="toolbar">
          {authenticated ? (
            <>
              <span className="wallet">{walletAddress || 'Wallet connected'}</span>
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
        {!isReady && (
          <div className="banner">
            Set `VITE_PRIVY_APP_ID`, `VITE_KRNL_NODE_URL`, and
            `VITE_KRNL_DELEGATED_CONTRACT` in `apps/web/.env` to enable KRNL.
          </div>
        )}
      </header>

      <section className="panel">
        <h2>Create session</h2>
        <div className="grid">
          <label>
            <span>Title</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
            />
          </label>
          <label>
            <span>Question count</span>
            <input
              type="number"
              min={5}
              max={50}
              value={draft.count}
              onChange={(event) => updateDraft('count', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Category</span>
            <input
              type="number"
              min={9}
              max={32}
              value={draft.category}
              onChange={(event) => updateDraft('category', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Difficulty</span>
            <select
              value={draft.difficulty}
              onChange={(event) =>
                updateDraft('difficulty', event.target.value as SessionDraft['difficulty'])
              }
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            <span>Type</span>
            <select
              value={draft.type}
              onChange={(event) =>
                updateDraft('type', event.target.value as SessionDraft['type'])
              }
            >
              <option value="boolean">True / False</option>
              <option value="multiple">Multiple choice</option>
            </select>
          </label>
        </div>
        <button className="primary" onClick={createSession}>
          {isCreating ? 'Creating...' : 'Create lobby'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {session && (
        <section className="panel">
          <h2>Lobby ready</h2>
          <div className="summary">
            <div>
              <strong>{session.title}</strong>
              <p>
                {session.count} questions · category {session.category} ·{' '}
                {session.difficulty}
              </p>
            </div>
            <div>
              <span>Session ID</span>
              <code>{session.id}</code>
            </div>
          </div>
          <div className="share">
            <span>Share link</span>
            <input readOnly value={sessionLink} />
          </div>
        </section>
      )}
    </>
  )
}

export default App
