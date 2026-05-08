# COMPONENT_MAP.md

```txt
src/app/
  App.tsx
  providers/AppProviders.tsx
  router/router.tsx
  router/ProtectedRoute.tsx

src/features/auth/
  components/LoginForm.tsx
  components/RegisterForm.tsx
  hooks/useAuthSession.ts
  api/authApi.ts

src/features/workspace/
  components/WorkspaceList.tsx
  components/CreateWorkspaceForm.tsx
  queries/useWorkspacesQuery.ts
  mutations/useCreateWorkspaceMutation.ts

src/features/sidebar/
  components/Sidebar.tsx
  components/ChannelList.tsx
  components/DocumentList.tsx

src/features/chat/
  components/ChatPanel.tsx
  components/MessageList.tsx
  components/MessageItem.tsx
  components/ChatInput.tsx
  hooks/useChatRoom.ts
  hooks/useMergedMessages.ts
  queries/useMessagesInfiniteQuery.ts

src/features/editor/
  components/EditorPanel.tsx
  components/CollaborativeEditor.tsx
  components/EditorToolbar.tsx
  hooks/useYEditorRoom.ts

src/features/presence/
  components/PresenceBar.tsx
  hooks/usePresence.ts

src/shared/
  ui/
  api/
  stores/
  lib/
  config/
```

Rules:
- pages orchestrate data
- feature components own feature UI
- shared UI contains no business logic
- hooks own side effects
- query hooks own Supabase reads
- realtime hooks own WebSocket/Yjs lifecycle
