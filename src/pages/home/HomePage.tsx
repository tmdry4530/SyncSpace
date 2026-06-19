import { Link } from 'react-router-dom'
import { routes } from '../../app/router/routes'
import '../../styles/apple/landing.css'

const features = [
  {
    title: '한눈에 보기',
    body: '대화, 문서, 팀원이 같은 화면에 모여 있어 흐름을 놓치지 않습니다.'
  },
  {
    title: '바로 정리하기',
    body: '회의 중 나온 결정과 할 일을 즉시 문서로 남길 수 있습니다.'
  },
  {
    title: '함께 이어가기',
    body: '팀원이 같은 공간에서 확인하고 다음 작업을 자연스럽게 이어갑니다.'
  }
] as const

const steps = [
  { title: '공간 만들기', body: '프로젝트나 팀 이름으로 새 워크스페이스를 시작합니다.' },
  { title: '초대하고 대화하기', body: '팀원을 초대해 필요한 내용을 한곳에서 이야기합니다.' },
  { title: '문서로 남기기', body: '결정 사항, 할 일, 회의록을 같은 화면에서 정리합니다.' }
] as const

export function HomePage() {
  return (
    <main className="ap-landing-page">
      <div className="ap-landing-shell">
        <header className="ap-landing-nav">
          <Link className="ap-landing-brand" to={routes.home}>
            <span className="ap-landing-brand-icon" aria-hidden="true">
              S
            </span>
            <span>SyncSpace</span>
          </Link>
          <nav className="ap-landing-nav-links" aria-label="홈 섹션">
            <a href="#features">특징</a>
            <a href="#flow">사용 방법</a>
            <a href="#preview">미리보기</a>
          </nav>
          <div className="ap-landing-nav-actions">
            <Link className="ap-landing-nav-login" to={routes.login}>
              로그인
            </Link>
            <Link className="ap-landing-pill ap-landing-pill-primary ap-landing-pill-sm" to={routes.login}>
              무료로 시작하기
            </Link>
          </div>
        </header>

        <section className="ap-landing-hero">
          <p className="ap-landing-eyebrow">TEAM WORKSPACE</p>
          <h1 className="ap-landing-title">팀의 대화와 문서를 한 공간에.</h1>
          <p className="ap-landing-subtitle">
            SyncSpace는 흩어진 채팅, 회의 메모, 작업 문서를 하나의 워크스페이스로 모아 팀이 더
            빠르게 정리하고 결정하도록 돕습니다.
          </p>
          <div className="ap-landing-hero-actions">
            <Link className="ap-landing-pill ap-landing-pill-primary ap-landing-pill-lg" to={routes.login}>
              지금 시작하기
            </Link>
            <a className="ap-landing-pill ap-landing-pill-ghost ap-landing-pill-lg" href="#preview">
              화면 둘러보기&nbsp;›
            </a>
          </div>

          <div className="ap-landing-lift" id="preview" aria-label="SyncSpace 작업 화면 미리보기">
            <div className="ap-landing-lift-bar">
              <span className="ap-landing-lift-bar-title">마케팅 팀 · 출시 준비</span>
              <span className="ap-landing-status">
                <span className="ap-landing-status-dot" aria-hidden="true" />
                함께 작업 중
              </span>
            </div>
            <div className="ap-landing-frame">
              <aside className="ap-landing-rail" aria-hidden="true">
                <span className="ap-landing-rail-logo">S</span>
                <span className="ap-landing-rail-item is-active" />
                <span className="ap-landing-rail-item" />
                <span className="ap-landing-rail-item" />
              </aside>
              <article className="ap-landing-note">
                <p className="ap-landing-note-eyebrow">TODAY&apos;S NOTE</p>
                <h2 className="ap-landing-note-title">회의가 끝나기 전에 정리까지 끝냅니다.</h2>
                <p className="ap-landing-note-body">
                  왼쪽에서 팀원과 이야기하고, 오른쪽에서 결정 사항과 할 일을 바로 문서로 남깁니다.
                  중요한 맥락이 대화 속에 묻히지 않습니다.
                </p>
              </article>
              <div className="ap-landing-chat">
                <strong className="ap-landing-chat-title">팀 대화</strong>
                <p className="ap-landing-bubble ap-landing-bubble-in">
                  이번 주 출시 범위는 여기까지로 정리할게요.
                </p>
                <p className="ap-landing-bubble ap-landing-bubble-out">
                  좋아요. 결정 사항을 문서에 바로 적어둘게요.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="ap-landing-features" id="features" aria-label="SyncSpace 주요 특징">
          <p className="ap-landing-features-eyebrow">FEATURES</p>
          <h2 className="ap-landing-features-title">흩어진 일을 한눈에.</h2>
          <div className="ap-landing-grid">
            {features.map((feature) => (
              <div className="ap-landing-card" key={feature.title} tabIndex={0}>
                <h3 className="ap-landing-card-title">{feature.title}</h3>
                <p className="ap-landing-card-body">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ap-landing-flow" id="flow" aria-label="SyncSpace 사용 방법">
        <p className="ap-landing-eyebrow">HOW IT WORKS</p>
        <h2 className="ap-landing-flow-title">복잡한 설정 없이, 팀 공간을 만들고 바로 협업하세요.</h2>
        <ol className="ap-landing-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
