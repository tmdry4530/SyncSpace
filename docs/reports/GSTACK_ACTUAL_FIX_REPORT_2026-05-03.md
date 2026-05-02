# gstack QA Report: SyncSpace

Date: 2026-05-03
GStack root used: `/home/chamdom/gstack`
Mode: QA + design-review fix loop, focused on previously found medium polish issues.
Target: local dev `http://127.0.0.1:5173`, production preview `http://localhost:4173`
Evidence: `dogfood-output/syncspace-gstack-actual-fix-20260503/`

## Health delta

| Area | Before | After | Result |
|------|--------|-------|--------|
| Login accessibility | Lighthouse 91, touch target fail | Lighthouse 100, target-size pass | fixed |
| SEO robots | robots.txt invalid, SEO 91 | robots.txt valid, SEO 100 | fixed |
| Mobile drawer focus | duplicate `사이드바 닫기` focus targets | single drawer close focus target | fixed |
| Home best practices | 96 | 100 | improved |

## Fixed issues

### 1. Login signup toggle hit area

Changed `.link-button` from text-sized `min-height: auto` to an inline-flex 36px hit area.

Evidence:

- `screenshots/01-login-touch-target-after.png`
- `logs/lighthouse-login-after.json`

### 2. Mobile drawer duplicate close control

Changed the drawer backdrop from a focusable button to an `aria-hidden` non-focusable backdrop, keeping only the explicit sidebar close button in the drawer focus order.

Evidence:

- `screenshots/03-mobile-drawer-closed-after-login.png`
- `screenshots/04-mobile-drawer-open-after-fix.png`
- `logs/04-mobile-drawer-open-snapshot.txt`

### 3. Missing robots.txt

Added `public/robots.txt`.

Evidence:

- `logs/robots.txt`
- `logs/lighthouse-home-after.json`
- `logs/lighthouse-login-after.json`

## Lighthouse after

| Route | Performance | Accessibility | Best Practices | SEO |
|-------|-------------|---------------|----------------|-----|
| `/auth/login` | 82 | 100 | 96 | 100 |
| `/` | 87 | 100 | 100 | 100 |

Notes: login still has one Lighthouse console/network item from the preview environment, but accessibility and SEO blockers are resolved. LCP remains about 3.2s to 3.8s and is the remaining low-priority performance polish item.

## Verification commands

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
```

All passed. Backend: 7 test files, 25 tests passed.

## Changed files

- `src/features/workspace/components/WorkspaceShell.tsx`
- `src/styles.css`
- `public/robots.txt`
- `.gstack/qa-reports/qa-report-syncspace-2026-05-03.md`
