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
          <a href="#features">특징</a>
          <a href="#flow">사용 방법</a>
          <a href="#preview">미리보기</a>
        </nav>
        <div className="landing-nav-actions">
          <Link className="button ghost small" to={routes.login}>로그인</Link>
          <Link className="button primary small" to={routes.login}>무료로 시작하기</Link>
        </div>
      </header>

      <section className="hero-card">
        <p className="eyebrow">TEAM WORKSPACE</p>
        <h1>팀의 대화와 문서를 한 공간에.</h1>
        <p className="hero-copy">
          SyncSpace는 흩어진 채팅, 회의 메모, 작업 문서를 하나의 워크스페이스로 모아
          팀이 더 빠르게 정리하고 결정하도록 돕습니다.
        </p>
        <div className="hero-actions">
          <Link className="button primary" to={routes.login}>
            지금 시작하기
          </Link>
          <a className="button ghost" href="#preview">화면 둘러보기</a>
        </div>
      </section>

      <section className="landing-preview" id="preview" aria-label="SyncSpace 작업 화면 미리보기">
        <div className="preview-topbar">
          <span>마케팅 팀 / 출시 준비</span>
          <span className="status-pill connected">함께 작업 중</span>
        </div>
        <div className="preview-frame">
          <aside aria-hidden="true">
            <span />
            <span />
            <span />
          </aside>
          <article>
            <p className="eyebrow">TODAY'S NOTE</p>
            <h2>회의가 끝나기 전에 정리까지 끝냅니다.</h2>
            <p>
              왼쪽에서 팀원과 이야기하고, 오른쪽에서 결정 사항과 할 일을 바로 문서로 남깁니다.
              중요한 맥락이 대화 속에 묻히지 않습니다.
            </p>
          </article>
          <div className="preview-chat">
            <strong>팀 대화</strong>
            <p>이번 주 출시 범위는 여기까지로 정리할게요.</p>
            <p>좋아요. 결정 사항을 문서에 바로 적어둘게요.</p>
          </div>
        </div>
      </section>

      <section className="hero-orbit" id="features" aria-label="SyncSpace 주요 특징">
        <div><strong>한눈에 보기</strong><span>대화, 문서, 팀원이 같은 화면에 모여 있어 흐름을 놓치지 않습니다.</span></div>
        <div><strong>바로 정리하기</strong><span>회의 중 나온 결정과 할 일을 즉시 문서로 남길 수 있습니다.</span></div>
        <div><strong>함께 이어가기</strong><span>팀원이 같은 공간에서 확인하고 다음 작업을 자연스럽게 이어갑니다.</span></div>
      </section>

      <section className="flow-section" id="flow" aria-label="SyncSpace 사용 방법">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>복잡한 설정 없이, 팀 공간을 만들고 바로 협업하세요.</h2>
        <ol>
          <li><strong>공간 만들기</strong><span>프로젝트나 팀 이름으로 새 워크스페이스를 시작합니다.</span></li>
          <li><strong>초대하고 대화하기</strong><span>팀원을 초대해 필요한 내용을 한곳에서 이야기합니다.</span></li>
          <li><strong>문서로 남기기</strong><span>결정 사항, 할 일, 회의록을 같은 화면에서 정리합니다.</span></li>
        </ol>
      </section>
    </main>
  )
}
