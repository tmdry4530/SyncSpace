import { describe, expect, it } from 'vitest'
import {
  ENGINEERING_EVENT_TYPES,
  EngineeringEventSchema
} from '../src/a2a/engineeringEvents.js'
import {
  ENGINEERING_EVENT_KINDS,
  REQUIRED_STRINGS,
  REQUIRED_ENUMS,
  type EngineeringEventKind
} from '../../src/shared/types/engineeringEvents.js'

/**
 * Event-vocab drift guard.
 *
 * The server zod schema (server/src/a2a/engineeringEvents.ts) and the FE mirror
 * (src/shared/types/engineeringEvents.ts) are two hand-maintained copies of the
 * same vocabulary. This test fails the build when they drift, by proving — for
 * every kind — that the FE's required-field expectations are a subset of what
 * the server zod schema actually enforces.
 *
 * Import note: the server vitest runs under tsx, which resolves `.js` ESM
 * specifiers back to their `.ts` sources, so the cross-package relative import
 * (`../../src/...`) resolves against the FE source directly. No fallback was
 * needed.
 */

/**
 * Build a minimal object that the server zod schema accepts for `kind`.
 * Includes every FE-required string and every FE-required enum field (with a
 * valid value) so that deleting any one of them is the only reason a later
 * safeParse could fail.
 */
function buildMinimalValid(kind: EngineeringEventKind): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    kind,
    timestamp: new Date().toISOString()
  }
  for (const field of REQUIRED_STRINGS[kind]) {
    obj[field] = `x-${field}`
  }
  for (const [field, values] of REQUIRED_ENUMS[kind] ?? []) {
    obj[field] = values[0]
  }
  return obj
}

describe('engineering event vocab parity (server zod ⇄ FE mirror)', () => {
  it('(a) the two kind lists are identical as sets', () => {
    const serverSet = new Set<string>(ENGINEERING_EVENT_TYPES)
    const feSet = new Set<string>(ENGINEERING_EVENT_KINDS)
    expect(feSet).toEqual(serverSet)
    // Guard against accidental duplicate entries that a Set comparison hides.
    expect(ENGINEERING_EVENT_TYPES.length).toBe(serverSet.size)
    expect(ENGINEERING_EVENT_KINDS.length).toBe(feSet.size)
  })

  it('(pre) every minimal-valid object the FE describes is accepted by the server schema', () => {
    for (const kind of ENGINEERING_EVENT_KINDS) {
      const obj = buildMinimalValid(kind)
      const result = EngineeringEventSchema.safeParse(obj)
      expect(result.success, `server schema rejected a minimal-valid ${kind}: ${JSON.stringify(
        result.success ? null : result.error.issues
      )}`).toBe(true)
    }
  })

  it('(b) every FE-required string field is also required by the server zod schema', () => {
    for (const kind of ENGINEERING_EVENT_KINDS) {
      for (const field of REQUIRED_STRINGS[kind]) {
        const obj = buildMinimalValid(kind)
        delete obj[field]
        const result = EngineeringEventSchema.safeParse(obj)
        expect(
          result.success,
          `server schema accepted ${kind} with FE-required string "${field}" deleted`
        ).toBe(false)
      }
    }
  })

  it('(b) every FE-required enum field is also required by the server zod schema', () => {
    for (const kind of ENGINEERING_EVENT_KINDS) {
      for (const [field] of REQUIRED_ENUMS[kind] ?? []) {
        const obj = buildMinimalValid(kind)
        delete obj[field]
        const result = EngineeringEventSchema.safeParse(obj)
        expect(
          result.success,
          `server schema accepted ${kind} with FE-required enum "${field}" deleted`
        ).toBe(false)
      }
    }
  })

  it('(c) each FE enum field accepts exactly the server zod enum values', () => {
    for (const kind of ENGINEERING_EVENT_KINDS) {
      for (const [field, values] of REQUIRED_ENUMS[kind] ?? []) {
        // Every FE-allowed value must be accepted by the server schema.
        for (const value of values) {
          const obj = buildMinimalValid(kind)
          obj[field] = value
          const result = EngineeringEventSchema.safeParse(obj)
          expect(
            result.success,
            `server schema rejected FE-allowed value "${value}" for ${kind}.${field}`
          ).toBe(true)
        }
        // A value the FE does NOT allow must be rejected by the server schema —
        // proving the server enum is not a strict superset (no extra values).
        const obj = buildMinimalValid(kind)
        const bogus = `__not_a_member__${field}`
        obj[field] = bogus
        const result = EngineeringEventSchema.safeParse(obj)
        expect(
          result.success,
          `server schema accepted a value outside the FE enum for ${kind}.${field}`
        ).toBe(false)
      }
    }
  })
})
