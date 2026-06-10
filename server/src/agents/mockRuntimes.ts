import type { AgentRole } from '../types/contracts.js'
import type { AgentRunContext, AgentRuntime } from './runtime.js'

const today = (): string => new Date().toISOString().slice(0, 10)

class PlannerRuntime implements AgentRuntime {
  role: AgentRole = 'planner'
  async run(ctx: AgentRunContext): Promise<void> {
    await ctx.emit.status('TASK_STATE_WORKING', '요구사항을 분석하고 계획을 작성하는 중입니다.')
    const plan = [
      `## Planner Agent 결과 · ${today()}`,
      '',
      '### 요구사항',
      `- ${ctx.userMessageText}`,
      '',
      '### 작업 분해',
      '1. 데이터 모델 정의',
      '2. API 설계',
      '3. 구현 및 테스트',
      '',
      '### 리스크',
      '- 범위 과대화에 따른 일정 지연',
      '- 권한/보안 경계 누락'
    ].join('\n')
    await ctx.emit.artifact({ artifactId: 'plan.md', name: 'Implementation Plan', parts: [{ text: plan }] })
    await ctx.emit.appendDocument(plan)
    await ctx.emit.message([{ text: '구현 계획 초안을 artifact와 문서에 정리했습니다. TaskDetail에서 확인하세요.' }])
    await ctx.emit.status('TASK_STATE_COMPLETED', '계획 작성을 완료했습니다.')
  }
}

class ReviewerRuntime implements AgentRuntime {
  role: AgentRole = 'reviewer'
  async run(ctx: AgentRunContext): Promise<void> {
    await ctx.emit.status('TASK_STATE_WORKING', '보안/권한/리스크를 검토하는 중입니다.')
    const review = [
      `## Reviewer Agent 결과 · ${today()}`,
      '',
      '### 검토 대상',
      `- ${ctx.userMessageText}`,
      '',
      '### 발견 사항',
      '- 모든 list/get 엔드포인트의 authorization boundary 확인 필요',
      '- webhook 대상 SSRF 검증 적용 확인',
      '',
      '### 권고',
      '- 권한 밖 리소스는 404로 응답하여 존재 노출 방지'
    ].join('\n')
    await ctx.emit.artifact({ artifactId: 'review.md', name: 'Risk Review', parts: [{ text: review }] })
    await ctx.emit.message([{ text: '리뷰 결과를 artifact로 작성했습니다.' }])
    await ctx.emit.status('TASK_STATE_COMPLETED', '리뷰를 완료했습니다.')
  }
}

class DocWriterRuntime implements AgentRuntime {
  role: AgentRole = 'doc_writer'
  async run(ctx: AgentRunContext): Promise<void> {
    await ctx.emit.status('TASK_STATE_WORKING', '문서를 정리하는 중입니다.')
    const doc = [
      `## DocWriter Agent 결과 · ${today()}`,
      '',
      ctx.userMessageText,
      '',
      '문서 본문에 위 내용을 정리했습니다.'
    ].join('\n')
    await ctx.emit.artifact({ artifactId: 'document.md', name: 'Document Section', parts: [{ text: doc }] })
    await ctx.emit.appendDocument(doc)
    await ctx.emit.message([{ text: '문서에 새 섹션을 추가했습니다.' }])
    await ctx.emit.status('TASK_STATE_COMPLETED', '문서 작성을 완료했습니다.')
  }
}

class BuilderRuntime implements AgentRuntime {
  role: AgentRole = 'builder'
  async run(ctx: AgentRunContext): Promise<void> {
    await ctx.emit.status('TASK_STATE_WORKING', '변경안을 작성하는 중입니다.')
    const patch = [
      `## Builder Agent 결과 · ${today()}`,
      '',
      '```diff',
      '+ // pseudo patch based on the plan',
      `+ // ${ctx.userMessageText}`,
      '```'
    ].join('\n')
    await ctx.emit.artifact({ artifactId: 'patch.md', name: 'Pseudo Patch', parts: [{ text: patch }] })
    await ctx.emit.message([{ text: '의사 패치를 artifact로 작성했습니다.' }])
    await ctx.emit.status('TASK_STATE_COMPLETED', '변경안 작성을 완료했습니다.')
  }
}

class OrchestratorRuntime implements AgentRuntime {
  role: AgentRole = 'orchestrator'
  async run(ctx: AgentRunContext): Promise<void> {
    await ctx.emit.status('TASK_STATE_WORKING', '에이전트 협업을 조율하는 중입니다.')
    // The trailing @planner mention kicks off the agent-to-agent pipeline:
    // the mention dispatcher creates a planner task on the same channel.
    await ctx.emit.message([
      { text: `planner → reviewer → doc 순서로 협업을 시작합니다.\n\n@planner 다음 요청의 구현 계획을 작성해주세요: ${ctx.userMessageText.slice(0, 500)}` }
    ])
    await ctx.emit.artifact({
      artifactId: 'orchestration.json',
      name: 'Orchestration Plan',
      parts: [{ data: { steps: ['planner', 'reviewer', 'doc_writer'] } }]
    })
    await ctx.emit.status('TASK_STATE_COMPLETED', '협업 계획을 정리했습니다.')
  }
}

const RUNTIMES: Record<AgentRole, AgentRuntime> = {
  planner: new PlannerRuntime(),
  reviewer: new ReviewerRuntime(),
  doc_writer: new DocWriterRuntime(),
  builder: new BuilderRuntime(),
  orchestrator: new OrchestratorRuntime()
}

export function getMockRuntime(role: AgentRole): AgentRuntime {
  return RUNTIMES[role]
}
