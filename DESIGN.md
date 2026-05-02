# SyncSpace Design System

## Product promise

SyncSpace is a split workbench for teams that decide in chat and write the decision down in the same moment.
The design should feel like a focused collaboration cockpit, not a generic dashboard.

## Aesthetic direction

- **Register:** product UI first, portfolio storytelling second.
- **Scene:** a maker team reviewing decisions on a desktop monitor, then checking the same room on mobile while moving between meetings.
- **Tone:** calm, precise, real-time, low-noise.

## Core layout

- Desktop workbench uses a persistent dark rail, a compact command bar, and two simultaneous panes: chat left, document right.
- Mobile uses a bottom `메뉴` drawer trigger, a command bar, and chat/document tabs. Sidebar content belongs in the drawer, not above the workspace.
- Realtime status is a single combined signal, never duplicated across chat and document panes.

## Typography

- App UI uses one conservative system stack for fast rendering and legibility:
  `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Marketing headings may later adopt a stronger Korean-friendly display font, but app controls should stay system-fast.
- Workbench headings stay compact: the product should feel dense but scannable.

## Color

- Base: warm off-white canvas with cool slate text.
- Navigation: deep navy rail for persistent orientation.
- Accent: emerald/green for realtime connected and successful copy actions.
- Warnings/errors: amber/red only for semantic states.
- Avoid decorative gradients in product controls.

## Spacing and touch

- Desktop density can be compact.
- Mobile interactive elements must satisfy a visible 44px tap target where practical.
- Bottom floating controls must respect `env(safe-area-inset-bottom)` and should not cover active content.

## Motion

- Prefer short, purposeful 120-180ms transitions.
- Do not animate layout-heavy properties in critical work areas.
- Realtime state changes should feel calm, not alarming.

## Component rules

- Invite code is a secondary action, not a primary CTA.
- Banner/help copy must be dismissible and should remain dismissed.
- Drawer backdrop should not be an extra focus stop; the explicit close button is the keyboard/screen-reader control.
- Empty/loading/error/reconnect states must be understandable without reading long instructions.

## Current quality baseline

- gstack design-review score: B+ after mobile polish.
- AI slop score: B, primarily because typography and public-page brand expression are still conservative.
- Visible mobile undersized tap target audit: passes with `[]` after the 2026-05-03 polish pass.
