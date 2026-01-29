import { useEffect, useMemo, useState } from 'react'
import { useKRNL } from '@krnl-dev/sdk-react-7702'
import { usePrivy } from '@privy-io/react-auth'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import type { CreatedSession, QuizQuestion, LeaderboardEntry } from '../types'
import { defaultDraft } from '../types'
import { createQuizVerifyWorkflow } from '../workflows'

export default function SessionPage() {
  const { id } = useParams()
  const sessionId = id ?? ''
  const [session, setSession] = useState<CreatedSession | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { executeWorkflowFromTemplate, embeddedWallet, isAuthorized, enableSmartAccount, resetSteps, statusCode, error: krnlError } = useKRNL()
  const { user } = usePrivy()
  const [isAuthorizing, setIsAuthorizing] = useState(false)

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

  useEffect(() => {
    if (!supabase || !sessionId) return
    const client = supabase

    const loadSession = async () => {
      console.log('Loading session', sessionId)
      const { data, error: fetchError } = await client
        .from('sessions')
        .select('id,title,created_at')
        .eq('id', sessionId)
        .single()

      if (fetchError) {
        console.error('Session load failed', fetchError)
        setError(fetchError.message)
        return
      }

      if (!data) {
        console.warn('Session not found', sessionId)
        setError('Session not found.')
        return
      }

      console.log('Session loaded', data.id)
      setSession({
        ...defaultDraft,
        title: data.title,
        id: data.id,
        createdAt: data.created_at,
      })
    }

    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (!supabase || !session) return
    const client = supabase

    const loadQuestions = async () => {
      console.log('Loading questions for session', session.id)
      const { data, error: fetchError } = await client
        .from('questions')
        .select('id, question, choices')
        .eq('session_id', session.id)
        .order('index_in_session', { ascending: true })

      if (fetchError) {
        console.error('Question load failed', fetchError)
        setError(fetchError.message)
        return
      }

      if (!data || data.length === 0) {
        console.warn('No questions found', session.id)
        setQuestions([])
        setCurrentIndex(0)
        return
      }

      const mapped = data.map((row) => {
        let choices: string[] = []
        if (Array.isArray(row.choices)) {
          choices = row.choices as string[]
        } else if (typeof row.choices === 'string') {
          try {
            const parsed = JSON.parse(row.choices)
            choices = Array.isArray(parsed) ? parsed : []
          } catch {
            choices = []
          }
        }

        return {
          id: row.id as string,
          prompt: row.question as string,
          choices,
        }
      })
      console.log('Questions loaded', mapped.length)
      setQuestions(mapped)
      setCurrentIndex(0)
      setSelectedAnswer('')
    }

    loadQuestions()
  }, [session, supabase])

  useEffect(() => {
    if (!supabase || !session) return
    const client = supabase

    let isMounted = true

    const loadLeaderboard = async () => {
      console.log('Loading leaderboard', session.id)
      const { data, error: fetchError } = await client
        .from('scores')
        .select('player_wallet,total_score,updated_at')
        .eq('session_id', session.id)
        .order('total_score', { ascending: false })

      if (fetchError) {
        console.error('Leaderboard load failed', fetchError)
        setError(fetchError.message)
        return
      }

      if (!isMounted) return
      console.log('Leaderboard loaded', (data ?? []).length)
      setLeaderboard((data ?? []) as LeaderboardEntry[])
    }

    loadLeaderboard()
    const interval = setInterval(loadLeaderboard, 8000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [session, supabase])

  const currentQuestion = questions[currentIndex]

  const refreshQuestions = async () => {
    if (!supabase || !session) return
    const client = supabase
    setIsRefreshing(true)
    const { data, error: fetchError } = await client
      .from('questions')
      .select('id, question, choices')
      .eq('session_id', session.id)
      .order('index_in_session', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setIsRefreshing(false)
      return
    }

    const mapped = (data ?? []).map((row) => {
      let choices: string[] = []
      if (Array.isArray(row.choices)) {
        choices = row.choices as string[]
      } else if (typeof row.choices === 'string') {
        try {
          const parsed = JSON.parse(row.choices)
          choices = Array.isArray(parsed) ? parsed : []
        } catch {
          choices = []
        }
      }

      return {
        id: row.id as string,
        prompt: row.question as string,
        choices,
      }
    })
    setQuestions(mapped)
    setCurrentIndex(0)
    setSelectedAnswer('')
    setIsRefreshing(false)
  }

  const handleAuthorize = async () => {
    if (!enableSmartAccount) {
      console.log('enableSmartAccount not available')
      return
    }
    console.log('Starting authorization...')
    console.log('embeddedWallet:', embeddedWallet)
    console.log('isAuthorized before:', isAuthorized)
    console.log('statusCode:', statusCode)
    console.log('krnlError:', krnlError)

    // Check if wallet needs to switch to Sepolia (chainId 11155111)
    if (embeddedWallet && embeddedWallet.chainId !== 'eip155:11155111') {
      console.log('Switching wallet to Sepolia...')
      try {
        await embeddedWallet.switchChain?.(11155111)
        console.log('Switched to Sepolia')
      } catch (switchErr) {
        console.error('Failed to switch chain:', switchErr)
        setError('Failed to switch to Sepolia network. Please try again.')
        return
      }
    }

    setIsAuthorizing(true)
    setError('')
    try {
      const success = await enableSmartAccount()
      console.log('enableSmartAccount result:', success)
      console.log('isAuthorized after:', isAuthorized)
      console.log('statusCode after:', statusCode)
      console.log('krnlError after:', krnlError)
      if (!success) {
        const errMsg = krnlError ? `Failed: ${krnlError}` : 'Smart account authorization failed. Check browser console for details.'
        setError(errMsg)
      }
    } catch (err: any) {
      console.error('Authorization failed', err)
      const message = err?.message || err?.reason || String(err)
      setError(`Authorization failed: ${message}`)
    } finally {
      setIsAuthorizing(false)
    }
  }

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

    // Direct Edge Function call (bypassing KRNL for testing)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    console.log('Calling quiz-verify Edge Function directly...')
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/quiz-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          sessionId: session.id,
          questionId: currentQuestion.id,
          answer: selectedAnswer,
          player: walletAddress || '0xPLAYER',
        }),
      })

      const result = await response.json()
      console.log('quiz-verify result:', result)

      if (!result.success) {
        setError(`Failed to verify answer: ${result.error || 'Unknown error'}`)
        return
      }

      console.log(`Answer verified: ${result.isCorrect ? 'Correct!' : 'Wrong'}`)
    } catch (err) {
      console.error('quiz-verify failed', err)
      setError(`Answer submission failed: ${String(err)}`)
      return
    }

    setSelectedAnswer('')
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length))
  }

  return (
    <>
      <PageHeader
        title="Join the quiz session"
        subtitle="Answer questions and submit proofs to the on-chain leaderboard."
      />

      {error && <p className="error">{error}</p>}

      {/* KRNL authorization panel - hidden while using direct Edge Function calls
      {session && !isAuthorized && (
        <section className="panel">
          <h2>Smart Account Authorization Required</h2>
          <p>
            To submit answers on-chain, you need to authorize your smart account.
            This enables EIP-7702 delegation for secure contract interactions.
          </p>
          <button className="primary" onClick={handleAuthorize} disabled={isAuthorizing}>
            {isAuthorizing ? 'Authorizing...' : 'Authorize Smart Account'}
          </button>
        </section>
      )}
      */}

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
              {currentQuestion.choices.map((choice, index) => (
                <button
                  key={`${currentQuestion.id}-${index}`}
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

      {session && questions.length === 0 && (
        <section className="panel">
          <h2>Questions not ready</h2>
          <p>
            We couldn&apos;t find questions yet. This usually means the KRNL
            `quiz_fetch` workflow has not finished writing to Supabase.
          </p>
          <button className="primary" onClick={refreshQuestions} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Retry question fetch'}
          </button>
        </section>
      )}

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
    </>
  )
}
