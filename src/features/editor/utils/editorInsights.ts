import type { Editor } from '@tiptap/react'
import type { DocumentMeta } from '../../../shared/types/contracts'

export interface EditorHeading {
  id: string
  level: number
  text: string
  pos: number
}

export interface WikiLinkInsight {
  label: string
  document?: DocumentMeta
}

export interface EditorInsights {
  headings: EditorHeading[]
  wikiLinks: WikiLinkInsight[]
  tags: string[]
  wordCount: number
}

const EMPTY_INSIGHTS: EditorInsights = {
  headings: [],
  wikiLinks: [],
  tags: [],
  wordCount: 0
}

export function getEditorInsights(editor: Editor | null, documents: DocumentMeta[] = []): EditorInsights {
  if (!editor) return EMPTY_INSIGHTS

  const headings: EditorHeading[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return

    const text = node.textContent.trim()
    if (!text) return

    headings.push({
      id: `heading-${pos}`,
      level: Number(node.attrs.level ?? 2),
      text,
      pos
    })
  })

  const text = editor.getText()
  const wikiLinks = collectWikiLinks(text, documents)
  const tags = collectTags(text)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return {
    headings,
    wikiLinks,
    tags,
    wordCount
  }
}

function collectWikiLinks(text: string, documents: DocumentMeta[]): WikiLinkInsight[] {
  const documentMap = new Map(documents.map((document) => [normalizeToken(document.title), document]))
  const seen = new Set<string>()
  const links: WikiLinkInsight[] = []
  const regex = /\[\[([^\]]+)\]\]/g

  for (const match of text.matchAll(regex)) {
    const label = match[1]?.trim()
    if (!label) continue

    const key = normalizeToken(label)
    if (seen.has(key)) continue

    seen.add(key)
    const document = documentMap.get(key)
    links.push(document ? { label, document } : { label })
  }

  return links
}

function collectTags(text: string): string[] {
  const seen = new Set<string>()
  const regex = /(^|\s)#([A-Za-z0-9가-힣_-]+)/g

  for (const match of text.matchAll(regex)) {
    const tag = match[2]?.trim()
    if (tag) seen.add(tag)
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'ko'))
}

function normalizeToken(value: string): string {
  return value.trim().toLocaleLowerCase('ko')
}
