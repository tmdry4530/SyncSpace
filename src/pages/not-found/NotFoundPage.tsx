import { Link } from 'react-router-dom'
import { routes } from '../../app/router/routes'
import '../../styles/apple/pages.css'

export function NotFoundPage() {
  return (
    <main className="ap-pg-shell ap-pg-shell--center">
      <div className="ap-pg-state-card">
        <div className="ap-pg-state-inner">
          <div className="ap-pg-state-code" aria-hidden="true">404</div>
          <h1 className="ap-pg-state-title">길을 잃었습니다</h1>
          <p className="ap-pg-state-copy">요청한 화면을 찾을 수 없습니다.</p>
          <Link className="ap-pg-pill ap-pg-pill--primary" to={routes.home}>홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  )
}
