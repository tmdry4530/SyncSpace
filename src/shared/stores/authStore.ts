import { create } from 'zustand'
import type { AuthAgentIdentity } from '../types/contracts'

interface AuthState {
  identity: AuthAgentIdentity | null
  isLoading: boolean
  setIdentity: (identity: AuthAgentIdentity | null) => void
  setLoading: (isLoading: boolean) => void
  reset: () => void
  /** Convenience accessor for the logged-in agent's participant id. */
  participantId: () => string | null
}

export const useAuthStore = create<AuthState>((set, get) => ({
  identity: null,
  isLoading: true,
  setIdentity: (identity) => set({ identity }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ identity: null, isLoading: false }),
  participantId: () => get().identity?.participantId ?? null
}))
