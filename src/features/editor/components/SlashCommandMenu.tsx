import type { Editor } from '@tiptap/react'
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquareCheck,
  Workflow
} from 'lucide-react'

export interface SlashCommandItem {
  id: string
  label: string
  description: string
  keywords: string[]
  icon: typeof Pilcrow
  run: (editor: Editor) => void
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'paragraph',
    label: '본문',
    description: '일반 문단으로 전환',
    keywords: ['paragraph', 'text', '본문', '문단'],
    icon: Pilcrow,
    run: (editor) => editor.chain().focus().setParagraph().run()
  },
  {
    id: 'heading-1',
    label: '제목 1',
    description: '큰 섹션 제목',
    keywords: ['h1', 'heading', 'title', '제목'],
    icon: Heading1,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    id: 'heading-2',
    label: '제목 2',
    description: '문서 목차에 잡히는 제목',
    keywords: ['h2', 'heading', 'section', '제목'],
    icon: Heading2,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    id: 'heading-3',
    label: '제목 3',
    description: '작은 하위 제목',
    keywords: ['h3', 'heading', 'sub', '제목'],
    icon: Heading3,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    id: 'bullet-list',
    label: '불릿 목록',
    description: '빠른 아이디어 정리',
    keywords: ['bullet', 'list', 'ul', '목록'],
    icon: List,
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    id: 'ordered-list',
    label: '번호 목록',
    description: '단계와 우선순위 정리',
    keywords: ['ordered', 'number', 'ol', '번호'],
    icon: ListOrdered,
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    id: 'todo',
    label: '체크 항목',
    description: '가벼운 할 일 표기',
    keywords: ['todo', 'task', 'check', '할일', '체크'],
    icon: SquareCheck,
    run: (editor) => editor.chain().focus().toggleBulletList().insertContent('[ ] ').run()
  },
  {
    id: 'quote',
    label: '인용',
    description: '결정 근거나 원문 보관',
    keywords: ['quote', 'blockquote', '인용'],
    icon: Quote,
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    id: 'callout',
    label: '콜아웃',
    description: '중요한 맥락을 눈에 띄게',
    keywords: ['callout', 'note', 'info', '콜아웃', '메모'],
    icon: Highlighter,
    run: (editor) => editor.chain().focus().toggleBlockquote().insertContent('💡 ').run()
  },
  {
    id: 'code-block',
    label: '코드 블록',
    description: '명령어와 스니펫 기록',
    keywords: ['code', 'pre', 'snippet', '코드'],
    icon: Code,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    id: 'divider',
    label: '구분선',
    description: '주제 전환을 명확하게',
    keywords: ['divider', 'hr', 'line', '구분선'],
    icon: Minus,
    run: (editor) => editor.chain().focus().setHorizontalRule().run()
  },
  {
    id: 'wiki-link',
    label: '문서 링크',
    description: '[[문서명]] 형태로 연결',
    keywords: ['wiki', 'link', 'backlink', '문서', '링크'],
    icon: Workflow,
    run: (editor) => editor.chain().focus().insertContent('[[문서명]]').run()
  }
]

interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  activeIndex: number
  query: string
  onSelect: (item: SlashCommandItem) => void
}

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const normalized = query.trim().toLocaleLowerCase('ko')
  if (!normalized) return SLASH_COMMANDS

  return SLASH_COMMANDS.filter((item) => {
    const haystack = [item.label, item.description, ...item.keywords].join(' ').toLocaleLowerCase('ko')
    return haystack.includes(normalized)
  })
}

export function SlashCommandMenu({ items, activeIndex, query, onSelect }: SlashCommandMenuProps) {
  if (items.length === 0) return null

  return (
    <div className="slash-command-menu" role="listbox" aria-label={`슬래시 명령 ${query ? query : '전체'}`}>
      <div className="slash-command-kicker">
        <span>/ 명령</span>
        <em>↑↓ 이동 · Enter 선택</em>
      </div>
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            className={`slash-command-item ${activeIndex === index ? 'active' : ''}`}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(item)
            }}
            type="button"
            role="option"
            aria-selected={activeIndex === index}
          >
            <span className="slash-command-icon">
              <Icon size={16} />
            </span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
