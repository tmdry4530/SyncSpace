import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../shared/stores/authStore'
import { routes } from './routes'

export function ProtectedRoute() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) return <div className="page-state">세션 확인 중...</div>
  if (!user) return <Navigate to={routes.login} replace state={{ from: location }} />

  return <Outlet />
}
