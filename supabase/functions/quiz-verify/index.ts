// Supabase Edge Function: quiz-verify
// Verifies answer, computes score, stores submission, returns proof data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hash function matching quiz-fetch
async function hashAnswer(answer: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(answer.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Convert string to bytes32 hex
function stringToBytes32(str: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  const hex = Array.from(bytes.slice(0, 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return '0x' + hex.padEnd(64, '0')
}

// Convert UUID to bytes32
function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, '')
  return '0x' + hex.padEnd(64, '0')
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId, questionId, answer, player } = await req.json()

    if (!sessionId || !questionId || !answer || !player) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: sessionId, questionId, answer, player',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Load question from database
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (fetchError || !question) {
      console.error('Question fetch error:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: 'Question not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify answer
    const answerHash = await hashAnswer(answer)
    const isCorrect = answerHash === question.correct_hash

    // Compute score delta (1 if correct, 0 if wrong)
    const scoreDelta = isCorrect ? 1 : 0

    // Generate proof hash (hash of session + question + player + answer + result)
    const proofInput = `${sessionId}:${questionId}:${player}:${answerHash}:${scoreDelta}`
    const proofHash = await hashAnswer(proofInput)

    // Store submission
    const { error: insertError } = await supabase.from('submissions').insert({
      session_id: sessionId,
      player_wallet: player,
      question_id: questionId,
      answer_choice: answer,
      proof_hash: proofHash,
    })

    if (insertError) {
      console.error('Submission insert error:', insertError)
      // Don't fail - submission storage is not critical for the response
    }

    // Update or create score
    const { data: existingScore } = await supabase
      .from('scores')
      .select('*')
      .eq('session_id', sessionId)
      .eq('player_wallet', player)
      .single()

    if (existingScore) {
      await supabase
        .from('scores')
        .update({
          total_score: existingScore.total_score + scoreDelta,
          proof_hash: proofHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingScore.id)
    } else {
      await supabase.from('scores').insert({
        session_id: sessionId,
        player_wallet: player,
        total_score: scoreDelta,
        proof_hash: proofHash,
      })
    }

    // Return proof data for on-chain submission
    // This data can be encoded by KRNL's encoder-evm executor
    const proofData = {
      sessionId: uuidToBytes32(sessionId),
      player: player, // Already an address
      questionId: uuidToBytes32(questionId),
      scoreDelta: scoreDelta,
      proofHash: proofHash,
    }

    console.log(`Verified answer for ${player}: correct=${isCorrect}, score=${scoreDelta}`)

    return new Response(
      JSON.stringify({
        success: true,
        isCorrect,
        scoreDelta,
        proofData,
        proofHash,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Quiz verify error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
