# API Reference

REST API documentation for Knowledge Base backend.

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://your-domain.com/api`

## Authentication

All endpoints (except auth endpoints and some external endpoints) require authentication via session cookie.

---

## Auth Endpoints

### Get Auth Configuration

```http
GET /api/auth/config
```

**Response:**
```json
{
  "enableRootLogin": true,
  "azureAdEnabled": true
}
```

### Azure AD Login

```http
GET /api/auth/login?redirect={url}
```

Redirects to Microsoft login page.

| Parameter | Type | Description |
|-----------|------|-------------|
| `redirect` | query | URL to redirect after login |

### OAuth Callback

```http
GET /api/auth/callback
```

Handles OAuth2 callback from Azure AD. Creates session and redirects to frontend.

### Root Login

```http
POST /api/auth/login/root
Content-Type: application/json
```

**Request:**
```json
{
  "username": "admin@localhost",
  "password": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "root",
    "email": "admin@localhost",
    "displayName": "Root Admin",
    "role": "admin"
  }
}
```

### Get Current User

```http
GET /api/auth/me
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@company.com",
  "displayName": "John Doe",
  "avatar": "https://...",
  "role": "admin",
  "department": "Engineering",
  "job_title": "Developer"
}
```

### Refresh Token

```http
POST /api/auth/refresh-token
```

Refreshes the current session token.

### Re-authenticate

```http
POST /api/auth/reauth
```

Forces re-authentication (e.g., for sensitive actions).

### Logout

```http
POST /api/auth/logout
```

Clears session and redirects to Azure AD logout.

### Token Status

```http
GET /api/auth/token-status
```

Checks validity of current token.

---

## User Management

*Requires `manage_users` permission.*

### List Users

```http
GET /api/users
```

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@company.com",
    "displayName": "John Doe",
    "role": "user",
    "department": "Engineering",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Update User Role

```http
PUT /api/users/:id/role
Content-Type: application/json
```

**Request:**
```json
{
  "role": "manager"
}
```

### Update User Permissions

```http
PUT /api/users/:id/permissions
Content-Type: application/json
```

**Request:**
```json
{
  "permissions": ["view_search", "view_chat"]
}
```

### Get IP History

```http
GET /api/users/ip-history
GET /api/users/:id/ip-history
```

Returns login history (IP addresses) for all users or a specific user.

---

## Team Management

*Requires `manage_users` permission.*

### List Teams

```http
GET /api/teams
```

### Create Team

```http
POST /api/teams
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Engineering",
  "description": "Engineering team"
}
```

### Update Team

```http
PUT /api/teams/:id
```

### Delete Team

```http
DELETE /api/teams/:id
```

### Manage Team Members

```http
GET /api/teams/:id/members
POST /api/teams/:id/members
DELETE /api/teams/:id/members/:userId
```

### Grant Team Permissions

```http
POST /api/teams/:id/permissions
```

---

## Knowledge Base Configuration

*Requires `manage_knowledge_base` permission.*

### Get Config

```http
GET /api/knowledge-base/config
```

### Update Config

```http
POST /api/knowledge-base/config
```

### Manage Sources

```http
GET /api/knowledge-base/sources
POST /api/knowledge-base/sources
PUT /api/knowledge-base/sources/:id
DELETE /api/knowledge-base/sources/:id
```

---

## MinIO Storage

### List Buckets

```http
GET /api/minio/buckets
```

### List Available Buckets

```http
GET /api/minio/buckets/available/list
```

### Create Bucket

```http
POST /api/minio/buckets
```

### Delete Bucket

```http
DELETE /api/minio/buckets/:name
```

### Storage Operations

```http
GET /api/minio/documents/:bucketId/list
POST /api/minio/documents/:bucketId/upload
POST /api/minio/documents/:bucketId/folder
DELETE /api/minio/documents/:bucketId/delete
POST /api/minio/documents/:bucketId/batch-delete
GET /api/minio/documents/:bucketId/download/*
```

---

## MinIO Raw (Admin)

*Requires `admin` role.*

```http
GET /api/minio/raw
GET /api/minio/raw/metrics
GET /api/minio/raw/:name/stats
POST /api/minio/raw
DELETE /api/minio/raw/:name
GET /api/minio/raw/keys
POST /api/minio/raw/keys
DELETE /api/minio/raw/keys/:accessKey
```

---

## Document Permissions

*Requires `admin` role.*

```http
GET /api/document-permissions
POST /api/document-permissions
GET /api/document-permissions/resolve
```

---

## Audit Logs

*Requires `admin` role or `view_audit_log` permission.*

### List Audit Logs

```http
GET /api/audit
```

**Query Parameters:**
- `page`, `limit`
- `userId`, `action`, `resourceType`
- `startDate`, `endDate`, `search`

### Get Metadata

```http
GET /api/audit/actions
GET /api/audit/resource-types
```

---

## System Tools

*Requires `view_system_tools` or `manage_system` permission.*

```http
GET /api/system-tools
GET /api/system-tools/health
POST /api/system-tools/:id/run
```

---

## Broadcast Messages

*Requires `manage_system` to create/delete.*

### Get All (Admin)

```http
GET /api/broadcast-messages
```

### Get Active (User)

```http
GET /api/broadcast-messages/active
```

### Create Message

```http
POST /api/broadcast-messages
```

### Update Message

```http
PUT /api/broadcast-messages/:id
```

### Delete Message

```http
DELETE /api/broadcast-messages/:id
```

### Dismiss Message (User)

```http
POST /api/broadcast-messages/:id/dismiss
```

---

## Chat & Search History

### User History

```http
GET /api/user/history/chat
GET /api/user/history/chat/:sessionId
GET /api/user/history/search
GET /api/user/history/search/:sessionId
```

### Admin History

*Requires `admin` or `leader` role.*

```http
GET /api/admin/history/chat
GET /api/admin/history/chat/:sessionId
GET /api/admin/history/search
GET /api/admin/history/search/:sessionId
GET /api/admin/history/system-chat
```

### Chat Session Management

```http
GET /api/chat/sessions/search
DELETE /api/chat/sessions/:id
DELETE /api/chat/sessions
```

---

## Prompts & Tags

### Prompts

```http
GET /api/prompts
POST /api/prompts
PUT /api/prompts/:id
DELETE /api/prompts/:id
GET /api/prompts/:id/interactions
GET /api/prompts/:id/feedback-counts
POST /api/prompts/interactions
```

### Tags

```http
GET /api/prompts/tags
GET /api/prompt-tags
GET /api/prompt-tags/search
POST /api/prompt-tags
POST /api/prompt-tags/by-ids
```

### Prompt Permissions

```http
GET /api/prompts/permissions
POST /api/prompts/permissions
GET /api/prompts/permissions/my
```

---

## External Integration

### Trace API

```http
POST /api/external/trace/submit
POST /api/external/trace/feedback
```

### History API

*Requires External API Key.*

```http
POST /api/external/history/chat
POST /api/external/history/search
```

### Health Check

```http
GET /api/external/health
```

---

## Admin Dashboard

*Requires `admin` role.*

```http
GET /api/admin/dashboard
```

---

## Preview

```http
GET /api/preview/:bucketName/:fileName
```
