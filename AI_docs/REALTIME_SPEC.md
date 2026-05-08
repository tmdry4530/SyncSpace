# REALTIME_SPEC.md

## Connection URLs
```txt
VITE_REALTIME_URL=ws://localhost:4000
/chat/:channelId
/doc/:documentId
/presence/:workspaceId
```

## Chat Requirements
Client:
- connect on chat route mount
- send non-empty messages
- receive `chat:message`
- deduplicate by id/clientId
- expose connection status
- invalidate message history on reconnect

Server:
- validate JSON with zod
- verify user token if feasible
- check workspace membership if feasible
- persist message to Supabase
- broadcast saved message
- never crash on bad client message

## Document Requirements
- create Y.Doc per document ID
- connect via WebSocket provider
- bind Tiptap Collaboration extension
- bind CollaborationCursor/awareness if feasible
- cleanup provider and awareness on unmount

## Presence Requirements
At minimum:
- show online users in current document/workspace
- user id, display name, color, lastSeenAt

## Connection UX
Show:
- connected
- reconnecting
- disconnected

Behavior:
- disable chat input when disconnected if no fallback
- toast on disconnect/reconnect
- resync/refetch on reconnect
