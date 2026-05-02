import type { AwarenessState } from '../../../shared/types/contracts'

export function UserAvatarStack({ states }: { states: AwarenessState[] }) {
  const uniqueUsers = states.filter((state, index, array) => array.findIndex((item) => item.user.id === state.user.id) === index)

  return (
    <div className="avatar-stack" aria-label="현재 접속자">
      {uniqueUsers.slice(0, 5).map((state) => (
        <span key={state.user.id} style={{ backgroundColor: state.user.color }} title={state.user.displayName}>
          {state.user.displayName.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {uniqueUsers.length > 5 ? <span className="avatar-extra">+{uniqueUsers.length - 5}</span> : null}
    </div>
  )
}
