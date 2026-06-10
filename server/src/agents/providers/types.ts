/**
 * Provider-neutral model interface. `liveRuntime` depends only on this — never on
 * a concrete SDK — so the provider can be swapped (anthropic today, others later)
 * and timeout/retry/error-normalization stay inside the provider.
 */
export interface ModelMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ModelCompleteInput {
  system: string
  messages: ModelMessage[]
  maxTokens: number
  timeoutMs: number
}

export interface ModelCompleteResult {
  text: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

export interface ModelProvider {
  complete(input: ModelCompleteInput): Promise<ModelCompleteResult>
}

/** Normalized provider failure — `code` is a stable, loggable classifier. */
export class ModelProviderError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ModelProviderError'
  }
}

export function normalizeProviderError(error: unknown): string {
  if (error instanceof ModelProviderError) return error.code
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
}
