import type { AppError } from '../types/contracts'

export function toAppError(error: unknown, fallback = '요청 처리 중 문제가 발생했습니다.'): AppError {
  if (isAppError(error)) return error

  if (error instanceof Error) {
    return {
      code: normalizeCode(error.name || 'unknown_error'),
      message: error.message || fallback
    }
  }

  if (isRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : 'unknown_error'
    const message = typeof error.message === 'string' ? error.message : fallback
    return { code: normalizeCode(code), message, details: error }
  }

  return { code: 'unknown_error', message: fallback, details: error }
}

export function missingSupabaseConfigError(): AppError {
  return {
    code: 'missing_supabase_config',
    message: 'VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 필요합니다.'
  }
}

function isAppError(value: unknown): value is AppError {
  return isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'unknown_error'
}
