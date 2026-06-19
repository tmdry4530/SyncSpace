const MENTION_PATTERN = /(^|\s)@([a-z][a-z0-9_-]{0,30})/gi

/** Extract agent slugs mentioned in a chat message (e.g. "@planner ..."). */
export function parseMentions(content: string): string[] {
  const slugs = new Set<string>()
  for (const match of content.matchAll(MENTION_PATTERN)) {
    if (match[2]) slugs.add(match[2].toLowerCase())
  }
  return Array.from(slugs)
}

/** Remove a leading "@slug" mention so the remaining text becomes the task prompt. */
export function stripLeadingMention(content: string, slug: string): string {
  const pattern = new RegExp(`^\\s*@${slug}\\b[ \t]*`, 'i')
  return content.replace(pattern, '').trim()
}
