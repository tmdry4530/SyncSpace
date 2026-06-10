import { randomInt } from 'node:crypto'
import { hashToken } from '../utils/crypto.js'

/**
 * Agent registration "capability gate" challenges.
 *
 * Honest framing: these do NOT prove the caller is an AI (a human can paste the
 * prompt into any LLM). They are a lightweight competence/intent check: the
 * prompt is a self-contained natural-language reasoning task whose answer is a
 * pure function of the prompt text. `solveChallengePrompt` re-derives the answer
 * from the prompt alone (used by the seed and tests); external callers must
 * actually reason about it.
 */

export type ChallengeTemplate = 'prime-sum' | 'nth-longest-word' | 'mod-arith'

export interface GeneratedChallenge {
  template: ChallengeTemplate
  prompt: string
  answer: string
}

const HEADER = '이 문제는 SyncSpace 에이전트 계정을 만들기 위한 역량 검증 문제입니다.'

/** Euclidean (always-non-negative) modulo, so the answer matches "mathematical mod". */
function euclideanMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

const WORD_BANK = [
  'orchestrator', 'agent', 'protocol', 'syncspace', 'workspace', 'participant',
  'document', 'channel', 'message', 'planner', 'builder', 'reviewer', 'token',
  'session', 'registration', 'collaboration', 'realtime', 'schema', 'migration'
]

export function generateChallenge(): GeneratedChallenge {
  const pick = randomInt(0, 3)
  if (pick === 0) return generatePrimeSum()
  if (pick === 1) return generateNthLongestWord()
  return generateModArith()
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase()
}

export function hashAnswer(answer: string, pepper: string | null): string {
  return hashToken(normalizeAnswer(answer), pepper)
}

/** Grade a submitted answer against a stored peppered hash. */
export function isAnswerCorrect(submitted: string, storedHash: string, pepper: string | null): boolean {
  return hashAnswer(submitted, pepper) === storedHash
}

/**
 * Re-derive the answer from a prompt produced by `generateChallenge`. Used by the
 * seed and integration tests; throws if the prompt is not a known template.
 */
export function solveChallengePrompt(prompt: string): string {
  if (prompt.includes('소수(prime number)')) return solvePrimeSum(prompt)
  if (prompt.includes('번째로 긴 단어')) return solveNthLongestWord(prompt)
  if (prompt.includes('mod')) return solveModArith(prompt)
  throw new Error('Unrecognized challenge prompt; cannot auto-solve.')
}

// ---------- prime-sum ----------

function generatePrimeSum(): GeneratedChallenge {
  const count = randomInt(6, 11)
  const numbers = Array.from({ length: count }, () => randomInt(2, 60))
  const prompt = [
    HEADER,
    '다음 정수 목록에서 소수(prime number)만 골라 그 합을 구하세요. 답은 정수 하나만 입력합니다.',
    `목록: [${numbers.join(', ')}]`
  ].join('\n')
  return { template: 'prime-sum', prompt, answer: String(sumPrimes(numbers)) }
}

function solvePrimeSum(prompt: string): string {
  return String(sumPrimes(parseNumberList(prompt)))
}

function sumPrimes(numbers: number[]): number {
  return numbers.filter(isPrime).reduce((total, value) => total + value, 0)
}

function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let divisor = 2; divisor * divisor <= n; divisor += 1) {
    if (n % divisor === 0) return false
  }
  return true
}

// ---------- nth-longest-word ----------

function generateNthLongestWord(): GeneratedChallenge {
  const count = randomInt(5, 8)
  const words = shuffle(WORD_BANK).slice(0, count)
  const n = randomInt(1, Math.min(4, count) + 1)
  const prompt = [
    HEADER,
    `다음 단어들 중에서 길이가 ${n}번째로 긴 단어를 답하세요. (길이가 같으면 먼저 나온 단어가 우선합니다.)`,
    `단어: [${words.join(', ')}]`
  ].join('\n')
  return { template: 'nth-longest-word', prompt, answer: nthLongestWord(words, n) }
}

function solveNthLongestWord(prompt: string): string {
  const words = parseWordList(prompt)
  const match = prompt.match(/길이가\s+(\d+)\s*번째로 긴/)
  const n = match ? Number(match[1]) : 1
  return nthLongestWord(words, n)
}

function nthLongestWord(words: string[], n: number): string {
  // Stable sort by length desc; earlier words win ties (Array.sort is stable).
  const sorted = words.map((word, index) => ({ word, index })).sort((a, b) => b.word.length - a.word.length || a.index - b.index)
  return sorted[Math.max(0, Math.min(n - 1, sorted.length - 1))]?.word ?? ''
}

// ---------- mod-arith ----------

function generateModArith(): GeneratedChallenge {
  const a = randomInt(10, 100)
  const b = randomInt(2, 20)
  const c = randomInt(1, 50)
  const m = randomInt(7, 30)
  const prompt = [
    HEADER,
    '다음 식의 결과를 구하세요: (a * b + c) mod m. 답은 정수 하나만 입력합니다.',
    `값: a=${a}, b=${b}, c=${c}, m=${m}`
  ].join('\n')
  return { template: 'mod-arith', prompt, answer: String(euclideanMod(a * b + c, m)) }
}

function solveModArith(prompt: string): string {
  const get = (key: string): number => {
    const match = prompt.match(new RegExp(`${key}=(-?\\d+)`))
    return match ? Number(match[1]) : 0
  }
  return String(euclideanMod(get('a') * get('b') + get('c'), get('m')))
}

// ---------- parsing helpers ----------

function parseNumberList(prompt: string): number[] {
  const match = prompt.match(/\[([^\]]*)\]/)
  if (!match) return []
  return (match[1] ?? '')
    .split(',')
    .map((piece) => Number(piece.trim()))
    .filter((value) => Number.isFinite(value))
}

function parseWordList(prompt: string): string[] {
  const match = prompt.match(/\[([^\]]*)\]/)
  if (!match) return []
  return (match[1] ?? '')
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1)
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}
