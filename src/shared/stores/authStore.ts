import { create } from 'zustand'
import type { AuthUser } from '../types/contracts'

interface AuthState {
  user: AuthUser | null
  participantId: string | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setParticipantId: (participantId: string | null) => void
  setLoading: (isLoading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  participantId: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setParticipantId: (participantId) => set({ participantId }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, participantId: null, isLoading: false })
}))
