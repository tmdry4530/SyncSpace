# SyncSpace UI/UX & Web Quality Audit

- Date: 2026-05-02
- Target: `http://127.0.0.1:5173`
- Audit mode: `frontend-design` critique, `impeccable` product UI review, `webapp-testing` browser workflow, `web-quality-audit` Lighthouse/manual checks, `e2e-testing-patterns` critical journey validation
- Evidence folder: `dogfood-output/syncspace-quality-audit-20260502/`

## Skill preflight notes

- `frontend-design`: used for visual hierarchy, layout, interaction polish critique.
- `impeccable`: context loader ran from installed skill path. `PRODUCT.md`/`DESIGN.md` are not present, so this audit treats the already imported Stitch `Synchronous Flow` design as the working design context. No UI mutation was made in this audit pass.
- `webapp-testing`: helper `with_server.py --help` checked. Python/Node Playwright packages are not installed in this repo, so live browser testing used `agent-browser` instead of native Playwright scripts.
- `web-quality-audit`: Lighthouse was run against Vite preview for the home page.
- `e2e-testing-patterns`: validated user-facing critical flows rather than implementation details.

## Executive summary

The desktop Stitch-inspired direction is strong: the dark structural navigation and light split workbench read clearly, core create/send/edit flows worked, and Lighthouse accessibility scored 100 on the home page. The biggest launch blocker is responsive behavior: on a 390px mobile viewport the workbench becomes effectively unusable because the sidebar consumes the top and the chat/editor controls appear far down in a mostly blank canvas. The next priority is performance: the production preview Lighthouse score is 79 with LCP around 3.9s and a 1.28 MB JS bundle.

## E2E scenario coverage

| Flow | Result | Evidence |
| --- | --- | --- |
| Home page render and navigation scan | Pass with one dead nav anchor issue | `screenshots/01-home-annotated.png`, `issue-001-flow-dead-anchor.png` |
| Invalid login error state | Pass functionally, copy issue found | `screenshots/03-login-invalid-error.png` |
| Valid login to workspace list | Pass | `screenshots/04-workspaces-annotated.png` |
| Open existing workspace workbench | Pass | `screenshots/05-workbench-annotated.png`, `06-workbench-reloaded.png` |
| Invite affordance | Pass, reveals copy action | `screenshots/07-invite-click-feedback.png` |
| Create channel | Pass, created `qa-ch-204010` | `screenshots/08-channel-create-click.png`, `09-channel-created.png` |
| Send chat message | Pass, sent `QA message 204010` | `screenshots/10-message-sent.png` |
| Create document | Pass, created `QA Doc 204010` | `screenshots/11-document-create-click.png`, `12-document-created.png` |
| Type in editor | Pass, typed `QA editor text 204010` | `screenshots/13-editor-typed.png` |
| Mobile home/workspaces/workbench | Home mostly pass, workspaces polish issues, workbench high severity | `screenshots/14-mobile-home-full.png`, `15-mobile-workspaces-full.png`, `16-mobile-workbench-full.png` |

## Lighthouse summary

Production preview target: `http://127.0.0.1:4173/`

| Category | Score |
| --- | ---: |
| Performance | 79 |
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 82 |

Key metrics:

- FCP: 3.9s
- LCP: 3.9s
- TTI: 4.0s
- TBT: 20ms
- CLS: 0.007
- Unused JS opportunity: 270 KB
- Production build warning: main JS chunk `1,278.82 kB`, gzip `380.00 kB`

Raw reports:

- `dogfood-output/syncspace-quality-audit-20260502/lighthouse-preview-home.json`
- `dogfood-output/syncspace-quality-audit-20260502/lighthouse-home.json` (dev server reference, lower score due dev server conditions)

## Findings

### Critical issues

None found.

### High priority

#### HIGH-001: Mobile workbench layout is not usable

- Category: Responsive UX / Layout
- Evidence: `dogfood-output/syncspace-quality-audit-20260502/screenshots/16-mobile-workbench-full.png`
- Repro:
  1. Set viewport to `390x844`.
  2. Open `/w/:workspaceId/ch/:channelId/doc/:documentId`.
  3. Observe that the sidebar dominates the top, then a large blank light canvas appears before chat/editor controls.
- Impact: The core product promise is the split workbench. On mobile, users cannot reasonably chat and edit because the content order and heights are broken.
- Recommendation:
  - Use a dedicated mobile workbench model instead of stacking the desktop split literally.
  - Convert sidebar into a collapsible drawer.
  - Use segmented tabs or a sticky switcher for `Chat` / `Document`.
  - Remove desktop `min-height: 100vh` assumptions from nested panes on small screens.
  - Keep message composer/editor toolbar attached to the visible active pane.

#### HIGH-002: Main bundle is too large for a fast first load

- Category: Performance
- Evidence: `pnpm verify:frontend` build warning; `lighthouse-preview-home.json`
- Details:
  - Main JS: `1,278.82 kB`, gzip `380.00 kB`.
  - Lighthouse Performance: 79.
  - LCP: 3.9s.
  - Unused JS opportunity: 270 KB.
- Impact: The landing page loads editor/realtime-heavy code too early, slowing first impression and weakening SEO/page quality.
- Recommendation:
  - Route-level lazy load authenticated workspace pages.
  - Dynamically import Tiptap/Yjs editor code only inside document routes.
  - Split auth/home/contract from workbench bundle.
  - Consider prefetching workbench after login rather than on first public page load.

### Medium priority

#### MEDIUM-001: Workbench panel titles show UUID fragments instead of human names

- Category: UX / Information architecture
- Evidence: `screenshots/10-message-sent.png`
- Observed: Chat title shows `#da02fbec`; document title can show `문서 <uuid fragment>` instead of `qa-ch-204010` / `QA Doc 204010`.
- Impact: Users cannot confidently tell which channel or document they are editing without cross-checking the sidebar.
- Recommendation: Resolve selected channel/document objects from query data and render their `name` / `title` in panel headers. Keep UUID only as debug metadata or tooltip if needed.

#### MEDIUM-002: Home navigation contains a dead `Flow` anchor

- Category: Functional / Navigation
- Evidence: `screenshots/issue-001-flow-dead-anchor.png`; DOM check showed `#flow` target is missing while `#features` exists.
- Impact: Top navigation looks functional but does not move users to content.
- Recommendation: Add a real `id="flow"` section or remove/rename the nav item.

#### MEDIUM-003: UI copy mixes Korean and English in primary flows

- Category: Content / UX copy
- Evidence: `screenshots/03-login-invalid-error.png`, `04-workspaces-annotated.png`, `15-mobile-workspaces-full.png`
- Examples:
  - `Invalid login credentials`
  - `Welcome back`
  - `Sign Out`
  - `Join Workspace`
  - `Create Workspace`
- Impact: Product tone feels unfinished and less portfolio-polished, especially because surrounding copy is Korean.
- Recommendation: Pick one language per product mode. For Korean portfolio mode, translate primary actions/errors consistently: `로그아웃`, `워크스페이스 참여`, `워크스페이스 생성`, `이메일 또는 비밀번호가 올바르지 않습니다`.

#### MEDIUM-004: Mobile workspace cards lose clear horizontal rhythm

- Category: Responsive UI polish
- Evidence: `screenshots/15-mobile-workspaces-full.png`
- Observed: The arrow wraps to its own line, the workspace tile becomes tall with sparse whitespace, and the top `Sign Out` target is visually tiny.
- Impact: The list is still usable, but it feels less intentional than desktop.
- Recommendation: On mobile, use a compact two-row tile: icon + title + chevron on row one, invite code on row two. Make logout a 44px-tall button or move it into a user menu.

### Low priority

#### LOW-001: Room switching emits transient WebSocket warnings in console

- Category: Console / Best practices
- Evidence: Console after create/switch flows showed `WebSocket is closed before the connection is established`; clearing and waiting produced no persistent errors.
- Impact: Not user-visible, but it adds noise and can hide real realtime regressions during QA.
- Recommendation: Ensure provider teardown during route switches is expected, debounce immediate reconnect/cleanup paths, or suppress known benign close-before-open warnings in development diagnostics.

#### LOW-002: Keyboard flow works, but focus treatment should be more intentional

- Category: Accessibility / Polish
- Evidence: keyboard tab sequence reached top nav and CTAs in order; Lighthouse accessibility score was 100.
- Impact: Functional accessibility is good, but focus styling appears to rely mostly on browser defaults and can get visually lost in dense workbench controls.
- Recommendation: Add a shared `:focus-visible` ring token with strong contrast for dark sidebar and light canvas contexts.

## Design critique

### What is working

- The Stitch `Synchronous Flow` direction fits the product: dark recessed navigation plus bright canvas reinforces “tools at the edge, work in the center”.
- Desktop workbench makes the Slack + Notion hybrid concept immediately understandable.
- Single `connected` status in the workbench is simpler than separate chat/doc badges.
- Invite action is discoverable after opening the invite affordance.

### What to polish next

1. Make the mobile workbench a first-class alternate layout, not a collapsed desktop grid.
2. Replace UUID fragments with user-facing room names everywhere.
3. Normalize copy language and action labels.
4. Split heavy editor/realtime code from the public landing path.
5. Add an onboarding/empty state that explains the left sidebar selection model before the first channel/doc exists.

## Recommended E2E test patterns

Add a small Playwright suite once `@playwright/test` is installed:

1. `auth.spec.ts`
   - invalid login shows localized error
   - valid login redirects to `/workspaces`
2. `workspace.spec.ts`
   - create workspace or join by invite
   - open workspace and verify split workbench visible
3. `realtime-workbench.spec.ts`
   - create channel
   - send message
   - create document
   - type editor content
   - reload and assert message/document persist
4. `responsive.spec.ts`
   - desktop workbench shows chat and document side-by-side
   - mobile workbench exposes usable chat/document navigation without blank vertical gaps
5. `a11y-smoke.spec.ts`
   - primary forms are label-addressable
   - keyboard tab order reaches nav, CTA, composer, toolbar
   - no console errors after load and after room switching

## Verification commands run

```bash
python /home/chamdom/.codex/skills/webapp-testing/scripts/with_server.py --help
python - <<'PY'
try:
 import playwright
 print('python playwright available')
except Exception as e:
 print('python playwright missing:', e)
PY
node -e "try{require('@playwright/test'); console.log('node @playwright/test available')}catch(e){console.log('node @playwright/test missing:', e.message)}"
CHROME_PATH=/usr/bin/chromium-browser npx -y lighthouse@12.2.1 http://127.0.0.1:4173/ --chrome-flags='--headless=new --no-sandbox --disable-gpu' --output=json --output-path=dogfood-output/syncspace-quality-audit-20260502/lighthouse-preview-home.json --quiet
pnpm verify:frontend
```

`pnpm verify:frontend` passed with the existing large chunk warning.


## Resolution update: 2026-05-02 Ralph fix pass

All findings above were addressed in the Ralph fix pass.

- HIGH-001 mobile workbench: added mobile Chat/Document tab switcher and removed the blank stacked split layout. Evidence: `dogfood-output/syncspace-fix-ui-quality-20260502/screenshots/10-mobile-workbench-final.png`, `11-mobile-final-post-deslop.png`.
- HIGH-002 bundle size: route-level lazy loading plus Vite manual chunks split the previous monolithic bundle. `pnpm verify:frontend` now completes without the previous chunk warning; largest emitted chunk is `editor-vendor` at about 486 kB. Lighthouse preview home improved to Performance 87 / Accessibility 100 / Best Practices 96 / SEO 91.
- MEDIUM-001 panel titles: chat/editor panels now receive and render selected channel/document names. Evidence: `05-workbench-human-titles.png`.
- MEDIUM-002 dead Flow anchor: home now includes a real `#flow` section. Evidence: `02-flow-anchor.png`.
- MEDIUM-003 mixed copy: primary auth/workspace actions and common auth error copy are Korean. Evidence: `03-login-korean-error.png`, `04-workspaces-korean.png`.
- MEDIUM-004 mobile workspace cards: mobile tile and logout styles were tightened. Evidence: `06-mobile-workspaces.png`.
- LOW-001 transient WebSocket warning: provider connect/cleanup now avoids destroying a connecting socket synchronously; post-switch console smoke showed only Vite/React info.
- LOW-002 focus polish: shared `:focus-visible` and dark-sidebar focus treatment are present.
