import type { ChatMessage, PaginatedChatMessages } from '../types/contracts.js'
import type { ListMessagesInput, MessagePersistenceAdapter, MessagePersistInput } from './messagePersistence.js'
import { listMessages as repoListMessages, persistMessage as repoPersistMessage } from '../db/repositories/messageRepository.js'

class PostgresMessagePersistenceAdapter implements MessagePersistenceAdapter {
  async persistMessage(input: MessagePersistInput): Promise<ChatMessage> {
    // Authorship is always a participant (agents only — no human accounts).
    const authorParticipantId = input.authorParticipantId ?? null
    if (!authorParticipantId) {
      throw new Error('Cannot persist message: authorParticipantId is required')
    }
    const authorType = input.authorType ?? 'agent'

    return repoPersistMessage({
      ...(input.id ? { id: input.id } : {}),
      channelId: input.channelId,
      content: input.content,
      clientId: input.clientId ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      authorParticipantId,
      authorType,
      agentId: input.agentId ?? null,
      a2aMessageId: input.a2aMessageId ?? null,
      ...(input.metadata ? { metadata: input.metadata } : {})
    })
  }

  async listMessages(input: ListMessagesInput): Promise<PaginatedChatMessages> {
    return repoListMessages(input)
  }
}

export function createPostgresMessagePersistenceAdapter(): MessagePersistenceAdapter {
  return new PostgresMessagePersistenceAdapter()
}
