const SERVER_STATE_POLL_MS = 1_500

export const realtimePolling = {
  refetchInterval: SERVER_STATE_POLL_MS,
  refetchIntervalInBackground: true
} as const
