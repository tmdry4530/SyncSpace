import type { Editor } from '@tiptap/react'
import { Bold, Code, Heading1, Heading2, Heading3, Highlighter, Italic, List, ListOrdered, Minus, Quote, Workflow } from 'lucide-react'

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="문서 편집 도구">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''} type="button" aria-label="굵게" title="굵게">
        <Bold size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''} type="button" aria-label="기울임꼴" title="기울임꼴">
        <Italic size={16} />
      </button>
      <span className="editor-toolbar-separator" aria-hidden="true" />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'active' : ''} type="button" aria-label="제목 1" title="제목 1">
        <Heading1 size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} type="button" aria-label="제목 2" title="제목 2">
        <Heading2 size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'active' : ''} type="button" aria-label="제목 3" title="제목 3">
        <Heading3 size={16} />
      </button>
      <span className="editor-toolbar-separator" aria-hidden="true" />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''} type="button" aria-label="글머리 기호 목록" title="불릿 목록">
        <List size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'active' : ''} type="button" aria-label="번호 목록" title="번호 목록">
        <ListOrdered size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'active' : ''} type="button" aria-label="인용" title="인용">
        <Quote size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().insertContent('💡 ').run()} className={editor.isActive('blockquote') ? 'active' : ''} type="button" aria-label="콜아웃" title="콜아웃">
        <Highlighter size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'active' : ''} type="button" aria-label="코드 블록" title="코드 블록">
        <Code size={16} />
      </button>
      <span className="editor-toolbar-separator" aria-hidden="true" />
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} type="button" aria-label="구분선" title="구분선">
        <Minus size={16} />
      </button>
      <button className="wide" onClick={() => editor.chain().focus().insertContent('[[문서명]]').run()} type="button" aria-label="문서 링크 삽입" title="문서 링크">
        <Workflow size={16} />
        링크
      </button>
    </div>
  )
}
