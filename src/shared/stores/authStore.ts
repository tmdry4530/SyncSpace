import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { UserProfile } from '../types/contracts'

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (isLoading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ session: null, user: null, profile: null, isLoading: false })
}))
