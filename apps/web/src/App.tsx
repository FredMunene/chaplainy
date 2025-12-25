import { useEffect, useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useKRNL } from '@krnl-dev/sdk-react-7702'
import { parseAbi, encodeFunctionData } from 'viem'
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

type QuizQuestion = {
  id: string
  prompt: string
  choices: string[]
}

type LeaderboardEntry = {
  player_wallet: string
  total_score: number
  updated_at: string
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
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const isReady = isKrnlConfigured
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { isAuthorized, enableSmartAccount, executeWorkflowFromTemplate, embeddedWallet } =
    useKRNL()

  const sessionIdFromPath = useMemo(() => {
    const match = window.location.pathname.match(/^\/session\/([a-f0-9-]+)$/i)
    return match ? match[1] : ''
  }, [])

  const sessionLink = useMemo(() => {
    if (!session) return ''
    return `${window.location.origin}/session/${session.id}`
  }, [session, supabase])

  useEffect(() => {
    if (!supabase || !session) return

    let isMounted = true

    const loadLeaderboard = async () => {
      const { data, error: fetchError } = await supabase
        .from('scores')
        .select('player_wallet,total_score,updated_at')
        .eq('session_id', session.id)
        .order('total_score', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      if (!isMounted) return
      setLeaderboard((data ?? []) as LeaderboardEntry[])
    }

    loadLeaderboard()
    const interval = setInterval(loadLeaderboard, 8000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [session, supabase])

  useEffect(() => {
    if (!supabase || !sessionIdFromPath || session) return

    const loadSession = async () => {
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select('id,title,created_at')
        .eq('id', sessionIdFromPath)
        .single()

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      if (!data) {
        setError('Session not found.')
        return
      }

      setSession({
        ...defaultDraft,
        title: data.title,
        id: data.id,
        createdAt: data.created_at,
      })
    }

    loadSession()
  }, [sessionIdFromPath, session, supabase])

  const walletAddress = useMemo(() => {
    const account = user as
      | { wallet?: { address?: string }; linkedAccounts?: Array<{ type?: string; address?: string }> }
      | undefined
    return (
      embeddedWallet?.address ??
      account?.wallet?.address ??
      account?.linkedAccounts?.find((item) => item.type === 'wallet')?.address ??
      ''
    )
  }, [user, embeddedWallet])

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
      login()
      return
    }

    if (!walletAddress) {
      setError('No wallet address found. Use a Privy embedded wallet and try again.')
      return
    }

    if (!embeddedWallet) {
      setError(
        'KRNL needs a Privy embedded wallet. Disconnect and reconnect using Privy, then try again.',
      )
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

    if (!executeWorkflowFromTemplate) {
      setError('KRNL workflow executor is unavailable.')
      setIsCreating(false)
      return
    }

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
      console.error('KRNL quiz_fetch failed', err)
      setError(`KRNL workflow failed to start: ${String(err)}`)
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

  useEffect(() => {
    if (!supabase || !session) return

    const loadQuestions = async () => {
      const { data, error: fetchError } = await supabase
        .from('questions')
        .select('id, question, choices')
        .eq('session_id', session.id)
        .order('index_in_session', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      if (!data || data.length === 0) {
        setQuestions([])
        setCurrentIndex(0)
        return
      }

      const mapped = data.map((row) => ({
        id: row.id as string,
        prompt: row.question as string,
        choices: Array.isArray(row.choices) ? row.choices : [],
      }))
      setQuestions(mapped)
      setCurrentIndex(0)
      setSelectedAnswer('')
    }

    loadQuestions()
  }, [session, supabase])

  const currentQuestion = questions[currentIndex]

  const submitAnswer = async () => {
    if (!selectedAnswer) {
      setError('Select an answer before submitting.')
      return
    }
    setError('')
    if (!session || !currentQuestion) {
      setError('No active question found.')
      return
    }

    if (!executeWorkflowFromTemplate) {
      setError('KRNL workflow executor is unavailable.')
      return
    }

    const template = {
      action: 'quiz_verify',
      params: {
        sessionId: '{{SESSION_ID}}',
        questionId: '{{QUESTION_ID}}',
        answer: '{{ANSWER}}',
        sessionNonce: '{{SESSION_NONCE}}',
        player: '{{PLAYER}}',
      },
    }

    const params = {
      '{{SESSION_ID}}': session.id,
      '{{QUESTION_ID}}': currentQuestion.id,
      '{{ANSWER}}': selectedAnswer,
      '{{SESSION_NONCE}}': '1',
      '{{PLAYER}}': walletAddress,
    }

    let attestation: any
    try {
      attestation = await executeWorkflowFromTemplate(template, params)
    } catch (err) {
      console.error('KRNL quiz_verify failed', err)
      setError(`KRNL answer verification failed: ${String(err)}`)
      return
    }

    const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined
    if (!contractAddress) {
      setError('Missing VITE_CONTRACT_ADDRESS env var.')
      return
    }

    const abi = parseAbi([
      'function submitProof((bytes32 sessionId,address player,bytes32 questionId,uint256 scoreDelta,uint256 nonce,uint256 expiry,bytes32 proofHash,bytes signature) attestation)',
    ])
    const callData = encodeFunctionData({
      abi,
      functionName: 'submitProof',
      args: [attestation],
    })

    await supabase?.from('submissions').insert({
      session_id: session.id,
      player_wallet: walletAddress,
      question_id: currentQuestion.id,
      answer_choice: selectedAnswer,
      proof_hash: attestation?.proofHash ?? null,
    })

    // TODO: Submit the transaction via KRNL SDK once contract submission helper is available.
    void callData

    setSelectedAnswer('')
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length))
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
        <button
          className="primary"
          onClick={createSession}
          disabled={!authenticated || isCreating}
        >
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

      {session && currentQuestion && (
        <section className="panel">
          <h2>Quiz in progress</h2>
          <div className="question">
            <div className="question-header">
              <span>
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
            <h3>{currentQuestion.prompt}</h3>
            <div className="choices">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice}
                  className={selectedAnswer === choice ? 'choice active' : 'choice'}
                  onClick={() => setSelectedAnswer(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
            <button className="primary" onClick={submitAnswer}>
              Submit answer
            </button>
          </div>
        </section>
      )}

      {session && !currentQuestion && questions.length > 0 && (
        <section className="panel">
          <h2>Quiz complete</h2>
          <p>You have answered all questions. Leaderboard updates soon.</p>
        </section>
      )}
    </>
  )
      {session && (
        <section className="panel">
          <h2>Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p>No scores yet. Once proofs land on-chain, scores will appear here.</p>
          ) : (
            <div className="leaderboard">
              {leaderboard.map((entry, index) => (
                <div key={entry.player_wallet} className="leaderboard-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="wallet">{entry.player_wallet}</span>
                  <span className="score">{entry.total_score}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
  
  
}

export default App
