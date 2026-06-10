import { ModelProviderError, type ModelCompleteInput, type ModelCompleteResult, type ModelProvider } from './types.js'

const DEFAULT_BASE_URL = 'https://api.anthropic.com'
const ANTHROPIC_VERSION = '2023-06-01'

export interface AnthropicProviderOptions {
  apiKey: string
  model: string
  baseUrl?: string
}

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

/**
 * Anthropic Messages API provider over raw fetch. Timeout, HTTP/transport error
 * mapping, and response normalization all live here — the runtime above stays
 * provider-agnostic. Text-only for the MVP (no tools, no streaming).
 */
export function createAnthropicProvider(options: AnthropicProviderOptions): ModelProvider {
  const endpoint = `${(options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')}/v1/messages`

  return {
    async complete(input: ModelCompleteInput): Promise<ModelCompleteResult> {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), input.timeoutMs)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': ANTHROPIC_VERSION
          },
          body: JSON.stringify({
            model: options.model,
            max_tokens: input.maxTokens,
            system: input.system,
            messages: input.messages
          }),
          signal: controller.signal
        })

        const raw = await response.text()
        if (!response.ok) {
          throw new ModelProviderError(`anthropic_${response.status}`, `Anthropic API ${response.status}: ${raw.slice(0, 300)}`)
        }

        let data: AnthropicMessagesResponse
        try {
          data = JSON.parse(raw) as AnthropicMessagesResponse
        } catch {
          throw new ModelProviderError('invalid_json', 'Anthropic API returned a non-JSON body.')
        }

        const text = (data.content ?? [])
          .filter((block) => block.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text as string)
          .join('\n')
          .trim()

        return {
          text,
          usage: {
            ...(typeof data.usage?.input_tokens === 'number' ? { inputTokens: data.usage.input_tokens } : {}),
            ...(typeof data.usage?.output_tokens === 'number' ? { outputTokens: data.usage.output_tokens } : {})
          }
        }
      } catch (error) {
        if (error instanceof ModelProviderError) throw error
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ModelProviderError('timeout', `Anthropic request timed out after ${input.timeoutMs}ms.`)
        }
        throw new ModelProviderError('request_failed', error instanceof Error ? error.message : String(error))
      } finally {
        clearTimeout(timeout)
      }
    }
  }
}
