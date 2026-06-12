# Phase 4 — Work-Surface Renderers

## Files Changed / Created

### New renderer components (src/features/missions/components/renderers/)
- `DiffRenderer.tsx` — file_edit renderer
- `CommandRenderer.tsx` — command_run renderer
- `TestResultRenderer.tsx` — test_result renderer
- `ReviewCommentRenderer.tsx` — review_comment renderer
- `VcsEventRenderer.tsx` — vcs_event renderer
- `AgentStatusRenderer.tsx` — agent_status renderer
- `PipelineStageRenderer.tsx` — pipeline_stage renderer

### Modified
- `src/features/missions/components/EventDetail.tsx` — replaced inline `renderEventBody` switch arms with imports of the per-kind renderer components; header (demo badge, timestamp, seq) unchanged.
- `src/styles.css` — appended ~380 lines of scoped renderer CSS under "Event Renderers" comment block, before the existing media query.

---

## Renderer Behaviour

### file_edit — DiffRenderer
- File header bar: path (monospace, bold) + addition/deletion count chips (green/red).
- Optional `summary` paragraph below the header.
- `parseDiff()` splits `unifiedDiff` line-by-line: lines starting with `+` (not `+++`) → `added` (green bg); `-` (not `---`) → `removed` (red bg); `@@` → `hunk` (muted/accent italic); blank → `blank`; everything else → `context` (default text).
- Scrollable diff viewport capped at 400 px.
- Graceful fallback: if `unifiedDiff` is absent/empty, shows "통합 diff 없음" in muted italic; no crash.

### command_run — CommandRenderer
- Dark terminal block (navy `#0f172a` bg), optional CWD in muted grey, `$` prompt char in accent green, command in white.
- Status pill (running → green, success → green, failed → red) + optional exit code.
- `stdoutTail` in light grey monospace (capped at 200 px scroll); `stderrTail` in red-tinted block with "stderr" label.
- Missing tails render nothing (no crash).

### test_result — TestResultRenderer
- Big pass/fail banner with ✓/✗ icon (green bg for passed, red for failed), suite name, verdict label.
- Stats row: passed count (green chip), failed count (red chip, only if > 0), durationMs.
- Failures list reuses `.event-detail-failures` styles (red-bordered list items with name + message).
- Graceful: missing `failures`, `passed`, `failed`, `durationMs` all handled with `?? 0` / conditional render.

### review_comment — ReviewCommentRenderer
- Card with header bar: file path + optional `lineStart–lineEnd` range (monospace), severity pill (info → blue, warn → amber, error → red), verdict badge (approve → green, request_changes → amber).
- Comment body in card content area.
- Missing `lineStart`/`lineEnd`/`verdict` render nothing (no crash).

### vcs_event — VcsEventRenderer
- Single row: action icon (⎇ branch_created / ● commit / ⇡ pr_opened), action label, branch chip (monospace bordered), short commitSha (7 chars), `prUrl` as external `<a>` link, summary (truncated with ellipsis).
- All fields optional except `action`; missing fields simply absent.

### agent_status — AgentStatusRenderer
- Bordered card with rows: agentId (monospace), role, status (reuses `.roster-status` pill classes for visual consistency with AgentRoster), currentAction (italic), optional path.

### pipeline_stage — PipelineStageRenderer
- Bordered card with rows: stage name, status pill (pending/active/done/failed → consistent with pipeline stepper colours), optional summary, startedAt and endedAt formatted with `ko-KR` locale.

---

## Degradation Strategy

Every renderer:
1. Uses optional chaining / nullish coalescing on all optional fields — no unguarded property access.
2. Renders nothing (or a placeholder string) when optional sections are absent.
3. Includes a `<details>` "raw JSON" expander at the bottom for debugging any event regardless of kind.
4. The `default` branch in `EventDetail.renderEventBody` still falls through to a raw `<pre>` for any future unknown kind.

---

## DEMO Badge

The `demo` badge is rendered in `EventDetail` header (unchanged from Phase 3 shell) and in `MissionTimeline` rows. No change needed in renderers.

---

## verify:frontend Result

```
pnpm verify:frontend

> tsc -p tsconfig.json --noEmit && vite build

vite v8.0.10 building client environment for production...
✓ 1965 modules transformed.
dist/assets/MissionView-7sfWkAgc.js  30.85 kB │ gzip: 5.94 kB
✓ built in 418ms
```

Exit code: 0. Zero TypeScript errors.
