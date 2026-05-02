import { AppProviders } from '../providers/AppProviders'
import { ProtectedRoute } from './ProtectedRoute'

export function ProtectedAppRoute() {
  return (
    <AppProviders>
      <ProtectedRoute />
    </AppProviders>
  )
}
