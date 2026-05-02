# gstack Design Review: SyncSpace

Date: 2026-05-03
GStack skill: `/home/chamdom/gstack/.agents/skills/gstack-design-review/SKILL.md`
Target: `http://127.0.0.1:5173`
Evidence: `dogfood-output/syncspace-gstack-design-review-20260503/`

## Headline scores

- **Design Score:** B+ after polish
- **AI Slop Score:** B, cohesive product-shell UI with a real split-workbench idea; still uses generic Inter/system typography and conventional SaaS neutrals, but no obvious slop patterns remain in the core workbench.

## First impression

I'm looking at a focused collaboration tool. The site communicates: **chat decisions and document work happen side-by-side**. My eye goes first to the dark navigation rail, then the split workbench title, then the message/editor division. That is the right hierarchy for this product.

The strongest part is the product concept: the workbench is materially different from another Slack/Notion clone because chat and document editing are visible at the same time. The weakest part before this pass was mobile affordance density: several controls were smaller than gstack's 44px mobile target rule, and the floating menu could visually compete with the chat stream.

One-word verdict: **usable**.

## Trunk test

| Question | Result |
|----------|--------|
| What site is this? | Pass, SyncSpace brand visible. |
| What page am I on? | Pass, current workspace and workbench title visible. |
| Major sections? | Pass, sidebar separates workspace, channels, documents. |
| Options at this level? | Pass, channel/document lists and create buttons visible. |
| Where am I? | Partial, active channel/doc is clear, but no explicit breadcrumb beyond title. |
| Search? | N/A for current scope, product does not currently expose search. |

Overall: **PASS** for the current portfolio feature scope.

## Inferred design system

- **Fonts:** one stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`.
- **Palette:** cool neutral shell, dark navy sidebar, green realtime/success accent, muted blue-gray avatars and surfaces.
- **Heading scale in workbench:** compact product-app scale, 15px to 17px on mobile/workbench surfaces.
- **Layout:** desktop persistent rail + split pane, mobile commandbar + tabbed pane + drawer.
- **Motion:** minimal. Mostly state transitions and drawer movement.

## Findings and fixes applied

### FINDING-001, Medium, Mobile affordance

**Before:** mobile touch-target extraction found several visible controls below 44px, including invite/user header buttons, sidebar add buttons, nav rows, banner dismiss, and send button.

**Fix:** added mobile-specific tap target rules:

- header invite/user controls: 44x44
- sidebar nav rows: min-height 44px
- sidebar create buttons and drawer close: min 44px
- banner dismiss: min-height 44px
- composer send button: min-width 44px

**After evidence:** `logs/touch-targets-mobile-after-pass2-visible.json` returns `[]` for visible undersized controls.

### FINDING-002, Polish, Floating menu competes with chat content

**Before:** the bottom-left `메뉴` pill sat over the scrollable chat region. It worked, but visually competed with message bubbles.

**Fix:** added mobile safe-area-aware bottom padding to `.message-list` and safe-area positioning for `.mobile-menu-trigger`.

**After evidence:** `screenshots/07-workbench-mobile-after-pass2.png`.

### FINDING-003, Polish, Mobile drawer density

**Before:** drawer rows were compact, closer to desktop list density.

**Fix:** mobile drawer list rows now use 44px minimum height, improving scan/tap confidence without changing information architecture.

**After evidence:** `screenshots/06-mobile-drawer-after.png`.

## Category grades

| Category | Grade | Notes |
|----------|-------|-------|
| Visual hierarchy | B+ | Workbench title and split panes are clear. |
| Typography | B | Consistent and readable, but generic Inter/system stack. |
| Color & contrast | B+ | Strong dark rail and clear realtime accent. |
| Spacing & layout | B+ | Desktop split is strong, mobile affordances fixed. |
| Navigation | B | Drawer and sidebar are clear. Search/breadcrumbs absent by product scope. |
| Interaction feedback | B+ | Invite copy, realtime status, active nav all visible. |
| Mobile design | B+ | Drawer/tab architecture is now practical and touch-safe. |
| Content clarity | B | Korean labels are clear; onboarding copy is concise. |
| Accessibility | A- | Visible undersized touch target audit passes after polish. |
| AI slop resistance | B | Real product shape; typography/neutral palette still conventional. |

## Verification

```bash
pnpm typecheck
pnpm verify:frontend
```

Both passed.

## Evidence files

- Before: `screenshots/03-workbench-desktop-before.png`, `screenshots/04-workbench-mobile-before.png`
- After: `screenshots/07-workbench-mobile-after-pass2.png`, `screenshots/08-workbench-desktop-after.png`
- Touch targets: `logs/touch-targets-mobile-before.json`, `logs/touch-targets-mobile-after-pass2-visible.json`
- Console errors: `logs/final-errors.txt`, empty

## Remaining design opportunities

1. Add lightweight breadcrumb or workspace/channel/doc metadata line if navigation grows.
2. Consider a more distinctive Korean-friendly display font for marketing pages only, while keeping app UI conservative.
3. Add search later if channel/document counts grow.
