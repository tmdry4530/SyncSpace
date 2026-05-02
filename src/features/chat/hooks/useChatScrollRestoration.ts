import { useEffect, useRef } from 'react'

export function useChatScrollRestoration(dependency: unknown) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceFromBottom < 160) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }, [dependency])

  return ref
}
