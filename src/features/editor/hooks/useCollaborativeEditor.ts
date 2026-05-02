import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type * as Y from 'yjs'

export function useCollaborativeEditor(ydoc: Y.Doc | null) {
  return useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Placeholder.configure({ placeholder: '함께 편집할 내용을 입력하세요...' }),
        ...(ydoc ? [Collaboration.configure({ document: ydoc })] : [])
      ],
      editorProps: {
        attributes: {
          class: 'editor-content'
        }
      }
    },
    [ydoc]
  )
}
