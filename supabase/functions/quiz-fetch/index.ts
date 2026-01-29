// Supabase Edge Function: quiz-fetch
// Fetches trivia questions, normalizes, hashes answers, and stores in database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple hash function using Web Crypto API
async function hashAnswer(answer: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(answer.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Decode HTML entities from OpenTDB responses
function decodeHtml(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
}

interface OpenTDBQuestion {
  category: string
  type: string
  difficulty: string
  question: string
  correct_answer: string
  incorrect_answers: string[]
}

interface OpenTDBResponse {
  response_code: number
  results: OpenTDBQuestion[]
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId, count, category, difficulty, type } = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build OpenTDB URL
    const params = new URLSearchParams({
      amount: String(count || 10),
    })
    if (category && category !== '0') params.set('category', String(category))
    if (difficulty && difficulty !== 'any') params.set('difficulty', difficulty)
    if (type && type !== 'any') params.set('type', type)

    const triviaUrl = `https://opentdb.com/api.php?${params.toString()}`
    console.log('Fetching trivia from:', triviaUrl)

    // Fetch trivia questions
    const triviaResponse = await fetch(triviaUrl)
    if (!triviaResponse.ok) {
      throw new Error(`OpenTDB API error: ${triviaResponse.status}`)
    }

    const triviaData: OpenTDBResponse = await triviaResponse.json()

    if (triviaData.response_code !== 0) {
      const errorMessages: Record<number, string> = {
        1: 'No results found for the specified parameters',
        2: 'Invalid parameter in request',
        3: 'Token not found',
        4: 'Token exhausted, reset needed',
      }
      throw new Error(errorMessages[triviaData.response_code] || 'Unknown OpenTDB error')
    }

    // Transform and hash questions
    const questions = await Promise.all(
      triviaData.results.map(async (q, index) => {
        const decodedQuestion = decodeHtml(q.question)
        const decodedCorrect = decodeHtml(q.correct_answer)
        const decodedIncorrect = q.incorrect_answers.map(decodeHtml)

        // Shuffle choices
        const allChoices = [decodedCorrect, ...decodedIncorrect]
        const shuffledChoices = allChoices.sort(() => Math.random() - 0.5)

        // Hash the correct answer
        const correctHash = await hashAnswer(decodedCorrect)

        return {
          session_id: sessionId,
          question: decodedQuestion,
          choices: shuffledChoices,
          correct_hash: correctHash,
          index_in_session: index,
        }
      })
    )

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Store questions in database
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    console.log(`Stored ${data.length} questions for session ${sessionId}`)

    return new Response(
      JSON.stringify({
        success: true,
        questionsCount: data.length,
        sessionId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Quiz fetch error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
