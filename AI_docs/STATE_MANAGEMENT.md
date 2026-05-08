# STATE_MANAGEMENT.md

## Rule
Every state must belong to exactly one layer.

| State | Owner |
|---|---|
| selected workspace/channel/document | Zustand |
| sidebar open/closed | Zustand |
| chat draft | Zustand |
| scroll position | Zustand |
| workspaces/channels/documents list | TanStack Query |
| message history | TanStack Query |
| document metadata | TanStack Query |
| editor CRDT content | Yjs |
| live chat socket events | WebSocket/Yjs realtime layer |
| presence/awareness | Yjs/WebSocket |

## Zustand Stores
- `workspaceUiStore`: selected/last workspace, channel, document
- `sidebarStore`: sidebar and section toggles
- `chatUiStore`: draft by channel, scroll position, at-bottom state
- `editorUiStore`: toolbar, focused document, cursor memory
- `connectionStore`: chat/doc connection status

## TanStack Query Hooks
- `useWorkspacesQuery`
- `useWorkspaceMembersQuery`
- `useChannelsQuery`
- `useDocumentsQuery`
- `useDocumentQuery`
- `useMessagesInfiniteQuery`

## Mutations
- `useCreateWorkspaceMutation`
- `useCreateChannelMutation`
- `useCreateDocumentMutation`
- `useUpdateDocumentTitleMutation`
- `useSendMessageFallbackMutation` if needed

## Realtime Hooks
- `useChatRoom(channelId)`
- `useYEditorRoom(documentId)`
- `usePresence(workspaceId)`

## Interview Explanation
State is separated by lifecycle and ownership. Zustand is local and browser-specific. TanStack Query owns persisted server data and cache invalidation. Yjs/WebSocket owns multi-user realtime state.
