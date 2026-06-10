import type { ServerConfig } from '../../config.js'
import { createAnthropicProvider } from './anthropicProvider.js'
import type { ModelProvider } from './types.js'

export type { ModelProvider, ModelCompleteInput, ModelCompleteResult, ModelMessage } from './types.js'
export { ModelProviderError, normalizeProviderError } from './types.js'

/**
 * Resolve the configured model provider. Throws if the provider is unknown or its
 * credentials are missing — `config.ts` already asserts this at boot, so reaching
 * here without a key means a misconfiguration we should surface, not swallow.
 */
export function getModelProvider(config: ServerConfig): ModelProvider {
  if (config.modelProvider === 'anthropic') {
    if (!config.anthropicApiKey) {
      throw new Error('MODEL_PROVIDER=anthropic requires ANTHROPIC_API_KEY.')
    }
    return createAnthropicProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel })
  }
  throw new Error(`Unsupported MODEL_PROVIDER: "${config.modelProvider}".`)
}
