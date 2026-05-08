# FRONTEND_SPEC.md

## Routes
| Path | Access | Description |
|---|---|---|
| `/` | public | landing |
| `/auth/login` | public | login |
| `/auth/register` | public | register |
| `/workspaces` | auth | workspace list |
| `/workspaces/new` | auth | create workspace |
| `/w/:workspaceId` | member | workspace home |
| `/w/:workspaceId/invite` | public/auth | invite landing placeholder |
| `/w/:workspaceId/ch/:channelId` | member | chat |
| `/w/:workspaceId/doc/:documentId` | member | editor |

## Required Components
Shared UI:
- Button, Input, Textarea, Avatar, Badge, Spinner, Skeleton, EmptyState, ErrorState, Toast/Toaster, Modal

Feature UI:
- LoginForm, RegisterForm
- WorkspaceList, CreateWorkspaceForm, WorkspaceSwitcher
- WorkspaceLayout, Sidebar, ChannelList, DocumentList
- PresenceBar
- ChatPanel, MessageList, MessageItem, ChatInput
- EditorPanel, DocumentTitleInput, CollaborativeEditor, EditorToolbar

## UX Requirements
- loading/empty/error states for all async screens
- active route visible in sidebar
- chat scroll restored per channel
- new message auto-scroll only if near bottom
- document title editable
- connection status visible
- basic responsive sidebar collapse

## Styling
Modern collaboration app, neutral palette, subtle borders, readable density, no excessive gradient-heavy generic SaaS styling.
