import { create } from 'zustand'

interface ChatUiState {
  draftByChannelId: Record<string, string>
  setDraft: (channelId: string, draft: string) => void
  clearDraft: (channelId: string) => void
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  draftByChannelId: {},
  setDraft: (channelId, draft) =>
    set((state) => ({ draftByChannelId: { ...state.draftByChannelId, [channelId]: draft } })),
  clearDraft: (channelId) =>
    set((state) => {
      const next = { ...state.draftByChannelId }
      delete next[channelId]
      return { draftByChannelId: next }
    })
}))
