---
name: backend:websocket
description: Add WebSocket events to the Socket.IO gateway — emit events to clients, handle incoming events, and manage rooms
---

# Backend WebSocket (Socket.IO Gateway)

## Architecture

The WebSocket gateway lives at `src/gateway/events.gateway.ts`. It is a single `@WebSocketGateway` class — do not create additional gateways.

```
src/gateway/
  events.gateway.ts    # @WebSocketGateway — all socket events
  gateway.module.ts    # Provides EventsGateway
```

`GatewayModule` is imported by `AppModule`. The `@WebSocketGateway` handles all namespaces.

## Emitting Events from a Service

Inject `EventsGateway` into any feature service to push real-time events to clients:

```typescript
// src/api/{module}/{module}.service.ts
import { EventsGateway } from '@gateway/events.gateway'; // or relative import

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsDb: NotificationsDbService,
    private readonly gateway: EventsGateway,
  ) {}

  async create(userId: string, dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = await this.notificationsDb.create(userId, dto);

    // Push real-time event to the user's socket room
    this.gateway.emitToUser(userId, 'notification:new', notification);

    return notification;
  }
}
```

## Adding an Inbound Event Handler

```typescript
// src/gateway/events.gateway.ts
@SubscribeMessage('message:send')
async handleSendMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: SendMessageDto,
): Promise<void> {
  // validate, process, emit back
  const userId = client.data.userId as string;
  await this.messageService.create(userId, data);
  this.server.to(userId).emit('message:received', data);
}
```

## Room Pattern (per-user rooms)

```typescript
// On connection — join the user's personal room
handleConnection(client: Socket): void {
  const userId = client.data.userId as string;
  void client.join(userId); // room name = userId for direct targeting
}

// Emit to a specific user
emitToUser(userId: string, event: string, data: unknown): void {
  this.server.to(userId).emit(event, data);
}

// Emit to all connected clients
emitToAll(event: string, data: unknown): void {
  this.server.emit(event, data);
}
```

## Event Naming Convention

Use `domain:action` format — lowercase, colon-separated:

```
notification:new
notification:read
message:received
user:status-changed
match:found
```

## Auth in WebSocket

Auth middleware is already wired in `events.gateway.ts`. The authenticated `userId` is available on `client.data.userId`. Do not re-implement auth in individual handlers — trust `client.data.userId` is set.

## Conventions

- **Single gateway** — all events go in `events.gateway.ts`; do not create domain-specific gateways
- **Emit from services, not controllers** — services know when state changes; controllers don't
- **Use `void client.join()`** — join returns a promise; use `void` to avoid unhandled promise warnings
- **Never block on socket emit** — emit is fire-and-forget; it never throws
- **Event names in colon-separated `domain:action` form** — `notification:new`, not `notificationNew` or `NOTIFICATION_NEW`
