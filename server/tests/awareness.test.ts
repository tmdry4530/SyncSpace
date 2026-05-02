import { describe, expect, it } from 'vitest'
import { isAwarenessState, sanitizeAwarenessState, touchAwarenessState } from '../src/realtime/awareness.js'

describe('awareness helpers', () => {
  it('validates and sanitizes contract presence payloads', () => {
    const state = {
      user: { id: 'u1', displayName: 'Ada', avatarUrl: null, color: '#7c3aed' },
      mode: 'document',
      cursor: { anchor: 1, head: 3 },
      lastSeenAt: 100,
      ignored: true
    }

    expect(isAwarenessState(state)).toBe(true)
    expect(sanitizeAwarenessState(state)).toEqual({
      user: { id: 'u1', displayName: 'Ada', avatarUrl: null, color: '#7c3aed' },
      mode: 'document',
      cursor: { anchor: 1, head: 3 },
      lastSeenAt: 100
    })
  })

  it('updates lastSeenAt without mutating the original payload', () => {
    const state = {
      user: { id: 'u1', displayName: 'Ada', avatarUrl: null, color: '#7c3aed' },
      mode: 'chat' as const,
      lastSeenAt: 100
    }

    expect(touchAwarenessState(state, 200)).toEqual({ ...state, lastSeenAt: 200 })
    expect(state.lastSeenAt).toBe(100)
  })
})
