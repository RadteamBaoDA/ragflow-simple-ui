# WebSocket API Documentation

RAGFlow Simple UI includes real-time WebSocket support using Socket.IO for notification events.

## Overview

The WebSocket server enables real-time bi-directional communication between:
- **Web Browser clients** (React frontend)
- **Python clients** (external automation scripts)
- **Backend services** (server-side event broadcasting)

## Server Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBSOCKET_ENABLED` | `true` | Enable/disable WebSocket server |
| `WEBSOCKET_CORS_ORIGIN` | `FRONTEND_URL` | CORS origin for connections |
| `WEBSOCKET_PING_TIMEOUT` | `60000` | Ping timeout in ms |
| `WEBSOCKET_PING_INTERVAL` | `25000` | Ping interval in ms |

## Connection

### Endpoint

```
ws://localhost:3001  (development)
wss://your-domain.com  (production with HTTPS)
```

### Authentication

Pass authentication data in the `auth` object when connecting:

```javascript
// Browser
const socket = io('http://localhost:3001', {
  auth: {
    email: 'user@example.com',
    userId: 'optional-user-id',
    token: 'optional-auth-token'
  }
});
```

```python
# Python
sio.connect(
    'http://localhost:3001',
    auth={'email': 'user@example.com'}
)
```

## Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe` | `string` (room name) | Join a room/channel |
| `unsubscribe` | `string` (room name) | Leave a room/channel |
| `ping` | - | Health check ping |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `notification` | `NotificationPayload` | Real-time notification |
| `pong` | `{ timestamp: string }` | Response to ping |
| `server:shutdown` | `{ message: string }` | Server shutdown warning |

### NotificationPayload

```typescript
interface NotificationPayload {
  type: string       // Notification type (e.g., 'info', 'warning', 'success')
  title?: string     // Optional title
  message: string    // Main notification message
  data?: object      // Optional additional data
  timestamp: string  // ISO 8601 timestamp
}
```

## Usage Examples

### Browser (React)

```typescript
import { connectSocket, subscribeToNotifications, disconnectSocket } from '@/lib/socket'
import { useEffect } from 'react'

function MyComponent() {
  useEffect(() => {
    // Connect with user authentication
    connectSocket({ email: 'user@example.com' })
    
    // Subscribe to notifications
    const unsubscribe = subscribeToNotifications((notification) => {
      console.log('Received:', notification)
      // Show toast, update UI, etc.
    })
    
    // Cleanup on unmount
    return () => {
      unsubscribe()
      disconnectSocket()
    }
  }, [])
  
  return <div>Listening for notifications...</div>
}
```

### Python Client

```bash
# Install dependency
pip install python-socketio

# Run example
python docs/websocket/python_client_example.py
```

See [python_client_example.py](./python_client_example.py) for complete example.

### Server-side (Backend Service)

```typescript
import { socketService } from '@/services/socket.service.js'

// Broadcast to all connected clients
socketService.sendNotification({
  type: 'info',
  message: 'System update completed',
})

// Send to specific user
socketService.sendNotificationToUser('user@example.com', {
  type: 'success',
  title: 'Upload Complete',
  message: 'Your file has been processed.',
})

// Send to specific room
socketService.sendNotificationToRoom('admin-room', {
  type: 'warning',
  message: 'High memory usage detected',
  data: { memoryUsage: 95 }
})
```

## Rooms/Channels

Users can subscribe to custom rooms for targeted notifications:

```javascript
// Client subscribes to room
socket.emit('subscribe', 'admin-notifications')

// Server sends to room
socketService.emitToRoom('admin-notifications', 'announcement', {
  message: 'New feature released!'
})
```

Each authenticated user automatically joins their user-specific room: `user:{userId}`

## Connection Status

The socket client tracks connection status:

```typescript
import { getSocketStatus, isSocketConnected } from '@/lib/socket'

// Get status: 'disconnected' | 'connecting' | 'connected' | 'error'
const status = getSocketStatus()

// Quick boolean check
if (isSocketConnected()) {
  // Socket is ready
}
```

## Troubleshooting

### Connection Fails

1. Verify backend is running: `curl http://localhost:3001/health`
2. Check CORS configuration in `.env`
3. Ensure `WEBSOCKET_ENABLED` is not set to `false`

### Python Client Issues

```bash
# Debug mode
python -c "import socketio; print(socketio.__version__)"

# Check connectivity
curl -v http://localhost:3001/socket.io/?EIO=4&transport=polling
```
