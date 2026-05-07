import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import { FileText, Hash, ListTree, Link2 } from 'lucide-react'
import { routes } from '../../../app/router/routes'
import type { DocumentMeta } from '../../../shared/types/contracts'
import { useWorkspaceUiStore } from '../../../shared/stores/workspaceUiStore'
import { getEditorInsights } from '../utils/editorInsights'

interface EditorKnowledgeRailProps {
  editor: Editor | null
  workspaceId: string
  documents?: DocumentMeta[]
}

export function EditorKnowledgeRail({ editor, workspaceId, documents = [] }: EditorKnowledgeRailProps) {
  const activeChannelId = useWorkspaceUiStore((state) => state.currentChannelId)
  const revision = useEditorRevision(editor)
  const insights = useMemo(() => getEditorInsights(editor, documents), [documents, editor, revision])

  function moveToHeading(pos: number) {
    editor?.chain().focus().setTextSelection(pos + 1).run()
  }

  return (
    <aside className="editor-knowledge-rail" aria-label="문서 구조와 링크">
      <div className="editor-stat-grid" aria-label="문서 요약">
        <span>
          <strong>{insights.wordCount}</strong>
          단어
        </span>
        <span>
          <strong>{insights.headings.length}</strong>
          제목
        </span>
      </div>

      <section className="editor-rail-section">
        <h2>
          <ListTree size={15} />
          목차
        </h2>
        {insights.headings.length > 0 ? (
          <div className="editor-outline">
            {insights.headings.map((heading) => (
              <button
                key={heading.id}
                className={`level-${heading.level}`}
                onClick={() => moveToHeading(heading.pos)}
                type="button"
                title={heading.text}
              >
                {heading.text}
              </button>
            ))}
          </div>
        ) : (
          <p className="editor-empty-note">제목을 만들면 여기서 바로 이동할 수 있어요.</p>
        )}
      </section>

      <section className="editor-rail-section">
        <h2>
          <Link2 size={15} />
          문서 링크
        </h2>
        {insights.wikiLinks.length > 0 ? (
          <div className="editor-link-list">
            {insights.wikiLinks.map((link) =>
              link.document ? (
                <Link key={link.label} to={getDocumentLinkTarget(workspaceId, link.document.id, activeChannelId)}>
                  <FileText size={14} />
                  <span>{link.document.title}</span>
                </Link>
              ) : (
                <span key={link.label} className="pending-wiki-link">
                  <FileText size={14} />
                  <span>{link.label}</span>
                  <em>후보</em>
                </span>
              )
            )}
          </div>
        ) : (
          <p className="editor-empty-note">[[문서명]]을 입력하면 연결 후보를 보여줘요.</p>
        )}
      </section>

      <section className="editor-rail-section">
        <h2>
          <Hash size={15} />
          태그
        </h2>
        {insights.tags.length > 0 ? (
          <div className="editor-tag-list">
            {insights.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        ) : (
          <p className="editor-empty-note">#결정, #todo처럼 맥락을 남겨보세요.</p>
        )}
      </section>
    </aside>
  )
}

function getDocumentLinkTarget(workspaceId: string, documentId: string, channelId: string | null): string {
  return channelId ? routes.workbench(workspaceId, channelId, documentId) : routes.document(workspaceId, documentId)
}

function useEditorRevision(editor: Editor | null): number {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!editor) return

    const bump = () => setRevision((value) => value + 1)
    bump()

    editor.on('update', bump)
    editor.on('selectionUpdate', bump)

    return () => {
      editor.off('update', bump)
      editor.off('selectionUpdate', bump)
    }
  }, [editor])

  return revision
}
