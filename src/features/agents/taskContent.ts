import type { A2aMessage, A2aTask, Part } from '../../shared/types/contracts'

/** Concatenate the text parts of a message into a single string. */
export function messageText(message: A2aMessage | undefined): string {
  if (!message) return ''
  return partsText(message.parts)
}

export function partsText(parts: Part[] | undefined): string {
  if (!parts) return ''
  return parts
    .map((part) => part.text ?? '')
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Best-effort human title for a task: first user message, else status message, else id. */
export function taskTitle(task: A2aTask): string {
  const firstUser = task.history?.find((message) => message.role === 'ROLE_USER')
  const fromHistory = messageText(firstUser)
  if (fromHistory) return truncate(fromHistory, 60)
  const fromStatus = messageText(task.status.message)
  if (fromStatus) return truncate(fromStatus, 60)
  return `태스크 ${task.id.slice(0, 8)}`
}

function truncate(value: string, max: number): string {
  const single = value.replace(/\s+/g, ' ').trim()
  return single.length > max ? `${single.slice(0, max - 1)}…` : single
}

export function formatTaskTime(timestamp: string | undefined): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
