// KRNL workflow DSL definitions - v2
// Simplified workflows using only supported executors (HTTP, EVM_ENCODER)
// Transform/hash logic moved to Supabase Edge Functions

const HTTP_EXECUTOR = 'ghcr.io/krnl-labs/executor-http@sha256:07ef35b261014304a0163502a7f1dec5395c5cac1fc381dc1f79b052389ab0d5'
const EVM_ENCODER_EXECUTOR = 'ghcr.io/krnl-labs/executor-encoder-evm@sha256:b28823d12eb1b16cbcc34c751302cd2dbe7e35480a5bc20e4e7ad50a059b6611'

export const createQuizFetchWorkflow = (senderAddress: string) => ({
  chain_id: '11155111',
  sender: senderAddress,
  delegate: '0x63cBcf35ea22FC674A23D453628398c60E1D05D5',
  attestor: HTTP_EXECUTOR,
  target: {
    contract: '0x63cBcf35ea22FC674A23D453628398c60E1D05D5',
    function: '',
    authData_result: '0x00',
    parameters: [],
  },
  sponsor_execution_fee: true,
  value: '0',
  intent: {
    id: '{{TRANSACTION_INTENT_ID}}',
    signature: '{{USER_SIGNATURE}}',
    deadline: '{{TRANSACTION_INTENT_DEADLINE}}',
  },
  rpc_url: '${_SECRETS.rpcSepoliaURL}',
  bundler_url: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=${_SECRETS.pimlico-apikey}',
  paymaster_url: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=${_SECRETS.pimlico-apikey}',
  gas_limit: '100000',
  max_fee_per_gas: '20000000000',
  max_priority_fee_per_gas: '2000000000',
  workflow: {
    name: 'quiz_fetch',
    version: '2.0.0',
    steps: [
      {
        name: 'fetch-and-store',
        type: 'HTTP',
        image: HTTP_EXECUTOR,
        config: {},
        inputs: {
          url: '${_SECRETS.supabaseUrl}/functions/v1/quiz-fetch',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ${_SECRETS.supabaseAnonKey}',
          },
          body: {
            sessionId: '{{INPUT.sessionId}}',
            count: '{{INPUT.count}}',
            category: '{{INPUT.category}}',
            difficulty: '{{INPUT.difficulty}}',
            type: '{{INPUT.type}}',
          },
        },
        outputs: [{ name: 'result', value: 'response.body', export: true }],
      },
    ],
  },
})

export const createQuizVerifyWorkflow = (senderAddress: string) => ({
  chain_id: '11155111',
  sender: senderAddress,
  delegate: '0x63cBcf35ea22FC674A23D453628398c60E1D05D5',
  attestor: HTTP_EXECUTOR,
  target: {
    contract: '0x63cBcf35ea22FC674A23D453628398c60E1D05D5',
    function: 'submitProofWithAuth((bytes32,address,bytes32,uint256,bytes32))',
    authData_result: '${encode-proof.result}',
    parameters: [],
  },
  sponsor_execution_fee: true,
  value: '0',
  intent: {
    id: '{{TRANSACTION_INTENT_ID}}',
    signature: '{{USER_SIGNATURE}}',
    deadline: '{{TRANSACTION_INTENT_DEADLINE}}',
  },
  rpc_url: '${_SECRETS.rpcSepoliaURL}',
  bundler_url: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=${_SECRETS.pimlico-apikey}',
  paymaster_url: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=${_SECRETS.pimlico-apikey}',
  gas_limit: '150000',
  max_fee_per_gas: '20000000000',
  max_priority_fee_per_gas: '2000000000',
  workflow: {
    name: 'quiz_verify',
    version: '2.0.0',
    steps: [
      {
        name: 'verify-answer',
        type: 'HTTP',
        image: HTTP_EXECUTOR,
        next: 'encode-proof',
        config: {},
        inputs: {
          url: '${_SECRETS.supabaseUrl}/functions/v1/quiz-verify',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ${_SECRETS.supabaseAnonKey}',
          },
          body: {
            sessionId: '{{INPUT.sessionId}}',
            questionId: '{{INPUT.questionId}}',
            answer: '{{INPUT.answer}}',
            player: '{{INPUT.player}}',
          },
        },
        outputs: [
          { name: 'proofData', value: 'response.body.proofData', export: true },
          { name: 'isCorrect', value: 'response.body.isCorrect', export: true },
        ],
      },
      {
        name: 'encode-proof',
        type: 'EVM_ENCODER',
        image: EVM_ENCODER_EXECUTOR,
        config: {
          parameters: [
            {
              name: 'proof',
              type: 'tuple',
              components: [
                { name: 'sessionId', type: 'bytes32' },
                { name: 'player', type: 'address' },
                { name: 'questionId', type: 'bytes32' },
                { name: 'scoreDelta', type: 'uint256' },
                { name: 'proofHash', type: 'bytes32' },
              ],
            },
          ],
        },
        inputs: {
          value: {
            proof: '${verify-answer.proofData}',
          },
        },
        outputs: [{ name: 'result', value: 'result', export: true }],
      },
    ],
  },
})

// Legacy exports for backwards compatibility
export const quizFetchWorkflow = createQuizFetchWorkflow('0x0000000000000000000000000000000000000000')
export const quizVerifyWorkflow = createQuizVerifyWorkflow('0x0000000000000000000000000000000000000000')
