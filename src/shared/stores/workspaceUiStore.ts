import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkspaceUiState {
  currentWorkspaceId: string | null
  currentChannelId: string | null
  currentDocumentId: string | null
  setCurrentWorkspaceId: (id: string | null) => void
  setCurrentChannelId: (id: string | null) => void
  setCurrentDocumentId: (id: string | null) => void
  clearWorkspaceSelection: () => void
}

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      currentChannelId: null,
      currentDocumentId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
      setCurrentChannelId: (id) => set({ currentChannelId: id }),
      setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
      clearWorkspaceSelection: () => set({ currentWorkspaceId: null, currentChannelId: null, currentDocumentId: null })
    }),
    {
      name: 'syncspace-workspace-ui'
    }
  )
)
