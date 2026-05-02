export function formatDisplayName(value: string | null | undefined, fallback = '사용자'): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback

  const emailPrefix = trimmed.match(/^([^@\s]+)@/)?.[1]
  const source = emailPrefix ?? trimmed
  const testUser = source.match(/(?:^|[._-])u(\d+)(?:[._-]|$)/i)
  if (testUser?.[1]) return `User ${testUser[1]}`
  if (source.length <= 18) return source
  return `${source.slice(0, 15)}…`
}
