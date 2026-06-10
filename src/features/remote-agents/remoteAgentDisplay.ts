import type { RemoteHealthStatus, RemoteVerificationStatus } from '../../shared/types/contracts'

/** Korean labels for remote-agent ownership verification status. */
export const VERIFICATION_STATUS_LABELS: Record<RemoteVerificationStatus, string> = {
  pending: '검증 대기',
  verified: '검증됨',
  rejected: '거부됨'
}

/** Compact CSS-friendly tone keyword per verification status (matches .agent-status-badge tones). */
export const VERIFICATION_STATUS_TONE: Record<RemoteVerificationStatus, string> = {
  pending: 'pending',
  verified: 'success',
  rejected: 'danger'
}

/** Korean labels for remote-agent health status. */
export const HEALTH_STATUS_LABELS: Record<RemoteHealthStatus, string> = {
  unknown: '상태 미확인',
  healthy: '정상',
  unhealthy: '비정상'
}

export const HEALTH_STATUS_TONE: Record<RemoteHealthStatus, string> = {
  unknown: 'neutral',
  healthy: 'success',
  unhealthy: 'danger'
}

export function verificationStatusLabel(status: RemoteVerificationStatus): string {
  return VERIFICATION_STATUS_LABELS[status] ?? status
}

export function verificationStatusTone(status: RemoteVerificationStatus): string {
  return VERIFICATION_STATUS_TONE[status] ?? 'neutral'
}

export function healthStatusLabel(status: RemoteHealthStatus): string {
  return HEALTH_STATUS_LABELS[status] ?? status
}

export function healthStatusTone(status: RemoteHealthStatus): string {
  return HEALTH_STATUS_TONE[status] ?? 'neutral'
}
