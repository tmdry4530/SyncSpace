import type { AwarenessState } from '../../../shared/types/contracts'
import { usePresenceUiStore } from '../../../shared/stores/presenceStore'
import { UserAvatarStack } from './UserAvatarStack'

export function PresenceBar({ states: providedStates }: { states?: AwarenessState[] }) {
  const storeStates = usePresenceUiStore((state) => state.states)
  const states = providedStates ?? storeStates

  return (
    <div className="presence-bar">
      <UserAvatarStack states={states} />
      <span>{states.length > 0 ? `${states.length}명 접속 중` : 'presence 대기 중'}</span>
    </div>
  )
}
