import { Link } from 'react-router-dom'
import { routes } from '../../app/router/routes'
import '../../styles/apple/pages.css'

const tables = [
  ['profiles', '사용자 표시 이름, 아바타, 색상'],
  ['workspaces', '작업 공간 메타데이터와 owner_id'],
  ['workspace_members', '워크스페이스별 멤버/역할'],
  ['channels', '워크스페이스 내부 채팅 채널'],
  ['documents', 'Yjs 문서 방의 메타데이터'],
  ['messages', '채팅 메시지 영속화']
]

const endpoints = [
  ['문서 협업', 'ws://<server>/doc/:workspaceId/:documentId'],
  ['채팅 협업', 'ws://<server>/chat/:workspaceId/:channelId'],
  ['헬스 체크', 'GET /health']
]

export function ContractPage() {
  return (
    <main className="ap-pg-shell">
      <div className="ap-pg-contract-frame">
        <article className="ap-pg-contract-doc">
          <Link className="ap-pg-brand" to={routes.home}>SyncSpace</Link>
          <p className="ap-pg-eyebrow">API CONTRACT FIRST</p>
          <h1 className="ap-pg-doc-title">프론트와 백엔드가 공유하는 계약</h1>
          <p className="ap-pg-doc-lede">
            SyncSpace는 Supabase 테이블, TanStack Query 함수, WebSocket/Yjs room 이름, presence payload, 에러 형태를
            먼저 고정하고 UI와 서버 구현을 그 계약에 맞춥니다.
          </p>

          <section className="ap-pg-section">
            <h2 className="ap-pg-section-title">상태 분리 원칙</h2>
            <ul className="ap-pg-bullets">
              <li className="ap-pg-bullet">
                <span><strong>Zustand</strong> <span className="ap-pg-bullet-note">— 사이드바, 현재 선택, 입력 UI 같은 로컬 상태</span></span>
              </li>
              <li className="ap-pg-bullet">
                <span><strong>TanStack Query</strong> <span className="ap-pg-bullet-note">— Supabase에서 가져오는 서버 상태와 캐시</span></span>
              </li>
              <li className="ap-pg-bullet">
                <span><strong>Yjs</strong> <span className="ap-pg-bullet-note">— 채팅/문서/presence의 실시간 협업 상태</span></span>
              </li>
            </ul>
          </section>

          <section className="ap-pg-section">
            <h2 className="ap-pg-section-title">Supabase tables</h2>
            <div className="ap-pg-table-grid">
              {tables.map(([name, description]) => (
                <div className="ap-pg-table-card" key={name}>
                  <code>{name}</code>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="ap-pg-section">
            <h2 className="ap-pg-section-title">Realtime endpoints</h2>
            <div className="ap-pg-endpoints">
              {endpoints.map(([label, value]) => (
                <p className="ap-pg-endpoint" key={label}>
                  <strong>{label}</strong>
                  <code>{value}</code>
                </p>
              ))}
            </div>
          </section>

          <section className="ap-pg-section">
            <h2 className="ap-pg-section-title">Error shape</h2>
            <pre className="ap-pg-code">
              <span className="ap-pg-code-kw">type</span>{` AppError = {
  code: string
  message: string
  details?: unknown
}`}
            </pre>
          </section>

          <div className="ap-pg-actions">
            <Link className="ap-pg-pill ap-pg-pill--primary" to={routes.login}>앱에서 테스트하기</Link>
            <Link className="ap-pg-pill ap-pg-pill--ghost" to={routes.home}>홈으로</Link>
          </div>
        </article>
      </div>
    </main>
  )
}
