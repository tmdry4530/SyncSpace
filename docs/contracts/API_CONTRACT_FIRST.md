# API Contract First

## 목적

백엔드는 AI가 구현하더라도 프론트엔드가 흔들리지 않도록 계약을 먼저 고정한다.

프론트는 다음 계약만 믿고 구현한다.

- Supabase table shape
- Query function return type
- WebSocket/Yjs room naming
- Presence payload
- Error shape

## Core Types

```ts
export type ID = string;

export interface UserProfile {
  id: ID;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

export interface Workspace {
  id: ID;
  name: string;
  ownerId: ID;
  inviteCode: string;
  createdAt: string;
}

export interface WorkspaceMember {
  workspaceId: ID;
  userId: ID;
  role: 'owner' | 'member';
  joinedAt: string;
  user: UserProfile;
}

export interface Channel {
  id: ID;
  workspaceId: ID;
  name: string;
  createdBy: ID;
  createdAt: string;
}

export interface ChatMessage {
  id: ID;
  channelId: ID;
  userId: ID;
  content: string;
  createdAt: string;
  clientId?: string;
  status?: 'sent' | 'pending' | 'failed';
  user?: UserProfile;
}

export interface DocumentMeta {
  id: ID;
  workspaceId: ID;
  title: string;
  createdBy: ID;
  updatedAt: string;
}
```

## Supabase Query Contracts

```ts
listMyWorkspaces(): Promise<Workspace[]>;
createWorkspace(input: { name: string }): Promise<Workspace>;
joinWorkspaceByInviteCode(input: { inviteCode: string }): Promise<Workspace>;
listChannels(workspaceId: string): Promise<Channel[]>;
createChannel(input: { workspaceId: string; name: string }): Promise<Channel>;
listDocuments(workspaceId: string): Promise<DocumentMeta[]>;
createDocument(input: { workspaceId: string; title: string }): Promise<DocumentMeta>;
listMessages(input: {
  channelId: string;
  cursor?: string | null;
  limit: number;
}): Promise<{
  items: ChatMessage[];
  nextCursor: string | null;
}>;
```

## Backend HTTP Contracts

초대 코드 참여는 service-role key가 필요한 서버 전용 작업이므로 프론트가 Supabase에 직접 쓰지 않는다.

```ts
POST `${VITE_API_URL}/api/workspaces/join`
Authorization: Bearer <supabase access token>
Content-Type: application/json

request: { inviteCode: string }
response: { workspace: Workspace }
error: AppError
```

## Room Naming

Yjs room 이름은 deterministic해야 한다.

```ts
const docRoom = `doc:${workspaceId}:${documentId}`;
const chatRoom = `chat:${workspaceId}:${channelId}`;
```

## WebSocket URLs

```ts
const WS_BASE_URL = import.meta.env.VITE_WS_URL;
const WS_AUTH_MODE = import.meta.env.VITE_WS_AUTH_MODE; // 'off' | 'supabase'

const docWsUrl = `${WS_BASE_URL}/doc/${workspaceId}/${documentId}`;
const chatWsUrl = `${WS_BASE_URL}/chat/${workspaceId}/${channelId}`;
```

`WS_AUTH_MODE=supabase`인 배포에서는 브라우저 클라이언트가 Supabase access token을
`Sec-WebSocket-Protocol: bearer, <token>` 형태로 전달한다. service-role key는 절대 프론트에 노출하지 않는다.

## Presence Payload

```ts
export interface PresenceUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

export interface AwarenessState {
  user: PresenceUser;
  cursor?: {
    anchor: number;
    head: number;
  };
  mode: 'chat' | 'document';
  lastSeenAt: number;
}
```

## Error Shape

```ts
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}
```

프론트 UI는 Supabase 원본 에러를 직접 렌더링하지 않는다.
반드시 adapter에서 `AppError`로 변환한다.
