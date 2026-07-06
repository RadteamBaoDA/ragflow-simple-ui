# Workflow 11: MCP Integration

## Goal

Start configured MCP servers, list their tools, and expose unsuppressed MCP tools as agent-callable functions.

## Key Files

- `server/utils/MCP/hypervisor/index.js`
- `server/utils/MCP/index.js`
- `server/endpoints/mcpServers.js`
- `frontend/src/models/mcpServers.js`
- `frontend/src/pages/Admin/Agents/MCPServers`

## Config File

MCP server definitions live in:

```text
storage/plugins/anythingllm_mcp_servers.json
```

Shape:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": [],
      "env": {},
      "anythingllm": {
        "autoStart": true,
        "suppressedTools": []
      }
    }
  }
}
```

HTTP/SSE MCP servers use `url` and optional `type`.

## Hypervisor Responsibilities

`MCPHypervisor` is a singleton. It:

- creates the config file if missing
- reads server configs
- starts stdio, SSE, or streamable HTTP transports
- patches environment PATH for child processes
- stores running clients in `mcps`
- tracks loading results in `mcpLoadingResults`
- prunes stopped servers
- updates suppressed tool lists

## Server Startup

`bootMCPServers()`:

1. Skips if servers are already running.
2. Reads all configured servers.
3. Skips servers with `anythingllm.autoStart === false`.
4. Parses transport type.
5. Validates required fields.
6. Starts the transport and connects an MCP client.
7. Records success or failure.

Connection has a 30 second timeout.

## Agent Tool Exposure

`MCPCompatibilityLayer.activeMCPServers()` boots servers and returns:

```text
@@mcp_<serverName>
```

During agent setup, `#attachPlugins` calls:

```js
convertServerToolsToPlugins(serverName, aibitat)
```

This:

1. Calls `mcp.listTools()`.
2. Removes suppressed tools.
3. Builds one plugin per remaining tool.
4. Uses tool name `${serverName}-${tool.name}`.
5. Uses the MCP tool `inputSchema` as the function parameters.
6. Handler calls `currentMcp.callTool({ name: tool.name, arguments: args })`.
7. The result is stringified safely with BigInt and circular-reference handling.

## Admin Endpoints

- `GET /mcp-servers/force-reload`
- `GET /mcp-servers/list`
- `POST /mcp-servers/toggle`
- `POST /mcp-servers/delete`
- `POST /mcp-servers/toggle-tool`

All require admin access.

## Frontend Admin Flow

`MCPServerHeader` loads server list lazily. The panel lets admins:

- inspect running status
- start/stop a server
- delete a server from config
- enable/disable individual MCP tools

Tool toggles update `anythingllm.suppressedTools` in the config file.

## Security Notes

MCP servers can execute arbitrary code or call external services. AnythingLLM treats MCP configuration as admin-controlled. The code does not install dependencies or verify tool safety; it only controls loading, visibility, and suppression.

## Rebuild Checklist

- Maintain a singleton MCP supervisor.
- Store MCP server config in a controlled file.
- Support stdio and remote transports.
- List tools and convert their schemas into agent tool schemas.
- Allow admins to suppress individual tools.
- Safely stringify arbitrary MCP results.
