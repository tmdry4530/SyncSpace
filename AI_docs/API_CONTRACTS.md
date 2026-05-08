# API_CONTRACTS.md

Create shared contracts in `packages/shared` and use them in both frontend and realtime server.

## Domain Types
```ts
type UserProfile = { id: string; displayName: string | null; avatarUrl: string | null }
type Workspace = { id: string; name: string; ownerId: string; inviteCode: string; createdAt: string }
type WorkspaceMember = { workspaceId: string; userId: string; role: 'owner' | 'member'; joinedAt: string; profile?: UserProfile }
type Channel = { id: string; workspaceId: string; name: string; createdBy: string; createdAt: string }
type Message = { id: string; channelId: string; userId: string; content: string; createdAt: string; user?: UserProfile }
type DocumentMeta = { id: string; workspaceId: string; title: string; createdBy: string; createdAt: string; updatedAt: string }
```

## Chat Client Event
```json
{
  "type": "chat:send",
  "clientId": "uuid",
  "workspaceId": "uuid",
  "channelId": "uuid",
  "content": "hello",
  "accessToken": "jwt"
}
```

## Chat Server Event
```json
{
  "type": "chat:message",
  "message": {
    "id": "uuid",
    "channelId": "uuid",
    "userId": "uuid",
    "content": "hello",
    "createdAt": "iso"
  }
}
```

## Error Event
```json
{
  "type": "error",
  "code": "unauthorized",
  "message": "User is not allowed."
}
```

## Naming
- DB rows use snake_case.
- UI/domain types use camelCase.
- Transform at API adapter boundary.
