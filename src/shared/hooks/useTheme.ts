import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'syncspace-theme'

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement
  // 'system' = no explicit attribute, so the prefers-color-scheme media query wins.
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

/**
 * Light / dark / system theme. The init script in index.html sets the attribute
 * before paint (no flash); this hook keeps React state in sync, persists the
 * choice, and keeps "system" live if the OS preference flips while the tab is open.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(readStored)

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode / blocked storage: still apply for this session.
    }
    apply(next)
    setThemeState(next)
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return { theme, setTheme }
}
