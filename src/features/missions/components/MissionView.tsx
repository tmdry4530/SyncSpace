import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMissionQuery } from '../hooks/useMissionQuery'
import { PipelineStepper } from './PipelineStepper'
import { AgentRoster } from './AgentRoster'
import { MissionTimeline } from './MissionTimeline'
import { EventDetail } from './EventDetail'
import { routes } from '../../../app/router/routes'
import '../../../styles/apple/mission-detail.css'

export function MissionView() {
  const { workspaceId, contextId } = useParams<{ workspaceId: string; contextId: string }>()
  const { missionData, isLoading, error } = useMissionQuery(contextId ?? null)
  const [selectedSeq, setSelectedSeq] = useState<string | null>(null)

  const selectedEvent =
    selectedSeq != null
      ? (missionData?.engineeringEvents.find((ev) => ev.seq === selectedSeq) ?? null)
      : null

  if (isLoading && !missionData) {
    return (
      <div className="page-state ap-md-page-state" aria-busy="true">
        미션 데이터를 불러오는 중...
      </div>
    )
  }

  // Only surface the error page when there is nothing to show — a transient
  // failed background poll must not wipe a populated view.
  if (error && !missionData) {
    return (
      <div className="page-state ap-md-page-state">
        <p className="form-error ap-md-error" role="alert">
          미션을 불러오지 못했습니다.
        </p>
      </div>
    )
  }

  const missionTitle =
    missionData?.detail.tasks[0]?.title ??
    (missionData?.detail.mission.contextId.slice(0, 12) ?? contextId)

  const backHref = workspaceId ? routes.missions(workspaceId) : routes.workspaces

  return (
    <div className="mission-view ap-md-view">
      <div className="ap-md-shell">
        {/* Top bar — glass nav */}
        <header className="mission-topbar ap-md-topbar">
          <div className="ap-md-back-row">
            <Link to={backHref} className="mission-back-link ap-md-back-link" aria-label="미션 목록으로 돌아가기">
              <ArrowLeft size={15} />
              <span>미션</span>
            </Link>
            <nav className="mission-breadcrumb ap-md-breadcrumb" aria-label="위치">
              <span>워크스페이스</span>
              <span className="ap-md-breadcrumb-sep" aria-hidden="true">›</span>
              {workspaceId ? (
                <Link to={routes.missions(workspaceId)}>미션</Link>
              ) : (
                <span>미션</span>
              )}
              <span className="ap-md-breadcrumb-sep" aria-hidden="true">›</span>
              <span className="mission-breadcrumb-current ap-md-breadcrumb-current">{missionTitle}</span>
            </nav>
          </div>
          <div className="mission-topbar-title">
            <h1 className="ap-md-title">{missionTitle}</h1>
          </div>
        </header>

        {/* Three-column layout */}
        <div className="mission-layout ap-md-grid">
          {/* LEFT — pipeline + roster */}
          <aside className="mission-left ap-md-col ap-md-col-left" aria-label="파이프라인 및 에이전트">
            <PipelineStepper stages={missionData?.pipelineStages ?? new Map()} />
            <AgentRoster
              roster={missionData?.agentRoster ?? new Map()}
              agents={missionData?.detail.agents ?? []}
            />
          </aside>

          {/* CENTER — selected event detail (work surface) */}
          <main className="mission-center ap-md-col ap-md-col-center" aria-label="작업 서피스">
            <EventDetail event={selectedEvent} />
          </main>

          {/* RIGHT — timeline */}
          <aside className="mission-right ap-md-col ap-md-col-right" aria-label="타임라인">
            <MissionTimeline
              events={missionData?.engineeringEvents ?? []}
              selectedSeq={selectedSeq}
              onSelect={setSelectedSeq}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
