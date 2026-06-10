import type { AgentRole } from '../types/contracts.js'
import type { AgentRunContext, AgentRuntime } from './runtime.js'
import { buildSystemPrompt } from './livePrompts.js'
import { normalizeProviderError, type ModelProvider } from './providers/index.js'

/** Hard cap on input length sent to the model (abuse / cost guard). */
const MAX_INPUT_CHARS = 32_000

export interface LiveRuntimeOptions {
  maxTokens: number
  timeoutMs: number
}

/**
 * A live agent runtime backed by a ModelProvider. Emits a single text result as a
 * chat message + a Markdown artifact, then marks the task complete. Provider
 * failures are caught and surfaced as a FAILED task — they never throw out of
 * `run`, so the worker process stays alive and the job is not retried in a loop.
 */
export function createLiveRuntime(role: AgentRole, provider: ModelProvider, options: LiveRuntimeOptions): AgentRuntime {
  return {
    role,
    async run(ctx: AgentRunContext): Promise<void> {
      await ctx.emit.status('TASK_STATE_WORKING', `${role} 에이전트가 작업 중입니다.`)

      const userText = (ctx.userMessageText ?? '').trim() || '(빈 요청)'
      // Conversation context first, request last (recency bias), bounded overall.
      const content = (ctx.conversationText
        ? `[Recent channel conversation]\n${ctx.conversationText}\n\n[Request]\n${userText}`
        : userText
      ).slice(0, MAX_INPUT_CHARS)

      let text: string
      try {
        const result = await provider.complete({
          system: buildSystemPrompt(role),
          messages: [{ role: 'user', content }],
          maxTokens: options.maxTokens,
          timeoutMs: options.timeoutMs
        })
        text = result.text.trim()
      } catch (error) {
        await ctx.emit.status('TASK_STATE_FAILED', `모델 호출 실패: ${normalizeProviderError(error)}`)
        return
      }

      if (!text) {
        await ctx.emit.status('TASK_STATE_FAILED', '모델이 빈 응답을 반환했습니다.')
        return
      }

      await ctx.emit.message([{ text }])
      await ctx.emit.artifact({ artifactId: `${role}-result.md`, name: `${role} result`, parts: [{ text }] })
      if (ctx.documentId) await ctx.emit.appendDocument(text)
      await ctx.emit.status('TASK_STATE_COMPLETED', '완료되었습니다.')
    }
  }
}
