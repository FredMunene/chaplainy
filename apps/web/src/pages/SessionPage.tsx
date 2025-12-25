import { useEffect, useMemo, useState } from 'react'
import { useKRNL } from '@krnl-dev/sdk-react-7702'
import { usePrivy } from '@privy-io/react-auth'
import { parseAbi, encodeFunctionData } from 'viem'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import type { CreatedSession, QuizQuestion, LeaderboardEntry } from '../types'
import { defaultDraft } from '../types'

export default function SessionPage() {
  const { id } = useParams()
  const sessionId = id ?? ''
  const [session, setSession] = useState<CreatedSession | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState('')
  const { executeWorkflowFromTemplate, embeddedWallet } = useKRNL()
  const { user } = usePrivy()

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

    const loadSession = async () => {
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select('id,title,created_at')
        .eq('id', sessionId)
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
  }, [sessionId])

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
      '{{PLAYER}}': walletAddress || '0xPLAYER',
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
      player_wallet: walletAddress || '0xPLAYER',
      question_id: currentQuestion.id,
      answer_choice: selectedAnswer,
      proof_hash: attestation?.proofHash ?? null,
    })

    void callData

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
