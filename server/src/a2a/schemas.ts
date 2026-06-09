import { z } from 'zod'
import { badRequest } from '../http/errors.js'

const PartSchema = z
  .object({
    text: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    file: z
      .object({
        name: z.string().optional(),
        mimeType: z.string().optional(),
        uri: z.string().optional(),
        bytes: z.string().optional()
      })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .refine((part) => part.text !== undefined || part.data !== undefined || part.file !== undefined, {
    message: 'Each part must contain text, data, or file.'
  })

const MessageSchema = z.object({
  messageId: z.string().min(1),
  role: z.enum(['ROLE_USER', 'ROLE_AGENT']).optional(),
  parts: z.array(PartSchema).min(1),
  taskId: z.string().optional(),
  contextId: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export const MessageSendSchema = z.object({
  message: MessageSchema,
  configuration: z
    .object({
      acceptedOutputModes: z.array(z.string()).optional(),
      blocking: z.boolean().optional()
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export type MessageSendRequest = z.infer<typeof MessageSendSchema>

export const PushConfigSchema = z.object({
  pushNotificationConfig: z.object({
    id: z.string().optional(),
    url: z.string().url(),
    token: z.string().optional(),
    authentication: z
      .object({
        schemes: z.array(z.string()).optional(),
        credentials: z.string().optional()
      })
      .optional()
  })
})

export type PushConfigRequest = z.infer<typeof PushConfigSchema>

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')
    throw badRequest('invalid_request', `Request validation failed: ${detail}`)
  }
  return result.data
}
