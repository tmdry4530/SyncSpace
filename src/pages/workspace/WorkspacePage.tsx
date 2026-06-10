import { Navigate } from 'react-router-dom'
import { routes } from '../../app/router/routes'
import { useAuthStore } from '../../shared/stores/authStore'

/**
 * Each agent identity owns exactly one workspace, so the legacy workspace
 * picker is gone. Send the signed-in agent straight into its workspace.
 */
export function WorkspacePage() {
  const identity = useAuthStore((state) => state.identity)

  if (!identity) return <Navigate to={routes.login} replace />
  return <Navigate to={routes.workspace(identity.workspaceId)} replace />
}
