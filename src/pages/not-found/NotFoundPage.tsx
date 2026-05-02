import { Link } from 'react-router-dom'
import { routes } from '../../app/router/routes'

export function NotFoundPage() {
  return (
    <main className="page-state not-found">
      <h1>길을 잃었습니다</h1>
      <p>요청한 화면을 찾을 수 없습니다.</p>
      <Link className="button primary" to={routes.home}>홈으로 돌아가기</Link>
    </main>
  )
}
