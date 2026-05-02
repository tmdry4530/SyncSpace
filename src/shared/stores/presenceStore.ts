import { create } from 'zustand'
import type { AwarenessState } from '../types/contracts'

interface PresenceUiState {
  states: AwarenessState[]
  setStates: (states: AwarenessState[]) => void
  clear: () => void
}

export const usePresenceUiStore = create<PresenceUiState>((set) => ({
  states: [],
  setStates: (states) => set({ states }),
  clear: () => set({ states: [] })
}))
