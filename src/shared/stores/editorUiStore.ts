import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface EditorUiState {
  isToolbarVisible: boolean
  lastFocusedDocumentId: string | null
  setToolbarVisible: (isToolbarVisible: boolean) => void
  setLastFocusedDocumentId: (documentId: string | null) => void
}

export const useEditorUiStore = create<EditorUiState>()(
  persist(
    (set) => ({
      isToolbarVisible: true,
      lastFocusedDocumentId: null,
      setToolbarVisible: (isToolbarVisible) => set({ isToolbarVisible }),
      setLastFocusedDocumentId: (lastFocusedDocumentId) => set({ lastFocusedDocumentId })
    }),
    {
      name: 'syncspace-editor-ui'
    }
  )
)
