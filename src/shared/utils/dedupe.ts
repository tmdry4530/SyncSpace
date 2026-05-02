export function uniqueBy<T>(items: readonly T[], getKey: (item: T) => string | null | undefined): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = getKey(item)
    if (!key) {
      result.push(item)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}
