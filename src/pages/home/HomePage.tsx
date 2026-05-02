import { Link } from 'react-router-dom'
import { routes } from '../../app/router/routes'

export function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand-lockup" to={routes.home}>
          <span className="brand-icon" aria-hidden="true">S</span>
          <span>SyncSpace</span>
        </Link>
        <nav aria-label="홈 섹션">
          <a href="#features">기능</a>
          <a href="#flow">작업 흐름</a>
          <Link to={routes.contract}>API</Link>
        </nav>
        <div className="landing-nav-actions">
          <Link className="button ghost small" to={routes.login}>로그인</Link>
          <Link className="button primary small" to={routes.login}>시작하기</Link>
        </div>
      </header>

      <section className="hero-card">
        <p className="eyebrow">SYNCHRONOUS FLOW</p>
        <h1>Chat and Document, Synchronized.</h1>
        <p className="hero-copy">
          채팅과 문서 작업을 분리하지 않고, 한 화면의 집중형 workbench에서 실시간으로 이어가는 협업 공간입니다.
        </p>
        <div className="hero-actions">
          <Link className="button primary" to={routes.login}>
            로그인하고 시작
          </Link>
          <Link className="button ghost" to={routes.contract}>API 계약 보기</Link>
        </div>
      </section>

      <section className="landing-preview" aria-label="SyncSpace 작업 화면 미리보기">
        <div className="preview-topbar">
          <span>Project Alpha / Product Requirements</span>
          <span className="status-pill connected">connected</span>
        </div>
        <div className="preview-frame">
          <aside aria-hidden="true">
            <span />
            <span />
            <span />
          </aside>
          <article>
            <p className="eyebrow">PHASE 1 ARCHITECTURE REVIEW</p>
            <h2>실시간 협업 상태를 한 곳에서 확인</h2>
            <p>왼쪽은 대화 흐름, 오른쪽은 공동 문서 편집에 집중합니다. 서버 상태와 CRDT 상태는 명확히 분리됩니다.</p>
          </article>
          <div className="preview-chat">
            <strong>Team Chat</strong>
            <p>API Spec 업데이트 확인했어요.</p>
            <p>문서 오른쪽에 반영했습니다.</p>
          </div>
        </div>
      </section>

      <section className="hero-orbit" id="features" aria-label="상태 레이어 요약">
        <div><strong>Zustand</strong><span>로컬 UI 상태만 가볍게 관리</span></div>
        <div><strong>TanStack Query</strong><span>서버 캐시와 무효화 담당</span></div>
        <div><strong>Yjs</strong><span>채팅, 에디터, presence 동기화</span></div>
      </section>

      <section className="flow-section" id="flow" aria-label="SyncSpace 작업 흐름">
        <p className="eyebrow">FLOW</p>
        <h2>대화에서 결정하고, 같은 화면에서 바로 문서화합니다.</h2>
        <ol>
          <li><strong>채널 선택</strong><span>팀 대화를 열고 맥락을 맞춥니다.</span></li>
          <li><strong>문서 선택</strong><span>관련 문서를 같은 workbench에 고정합니다.</span></li>
          <li><strong>실시간 동기화</strong><span>presence, 메시지, 편집 상태를 새로고침 없이 공유합니다.</span></li>
        </ol>
      </section>
    </main>
  )
}
