import type { ChatMessage, PaginatedChatMessages } from '../types/contracts.js'
import type { ListMessagesInput, MessagePersistenceAdapter, MessagePersistInput } from './messagePersistence.js'
import { listMessages as repoListMessages, persistMessage as repoPersistMessage } from '../db/repositories/messageRepository.js'
import { getHumanParticipantByUserId } from '../db/repositories/participantRepository.js'

class PostgresMessagePersistenceAdapter implements MessagePersistenceAdapter {
  async persistMessage(input: MessagePersistInput): Promise<ChatMessage> {
    const authorType = input.authorType ?? 'human'
    let authorParticipantId = input.authorParticipantId ?? null

    // Backwards compatible: resolve the human participant from a legacy userId.
    if (!authorParticipantId && input.userId) {
      const participant = await getHumanParticipantByUserId(input.userId)
      authorParticipantId = participant?.id ?? null
    }
    if (!authorParticipantId) {
      throw new Error('Cannot persist message: author participant could not be resolved')
    }

    return repoPersistMessage({
      ...(input.id ? { id: input.id } : {}),
      channelId: input.channelId,
      content: input.content,
      clientId: input.clientId ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      authorParticipantId,
      authorType,
      userId: authorType === 'human' ? input.userId ?? null : null,
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
