# Workflow 03: Skill Discovery And Enablement

## Goal

Build the list of tools that `@agent` can use, and let admins/users enable or disable them.

## Backend Sources

- `server/utils/agents/defaults.js`
- `server/utils/agents/aibitat/plugins/index.js`
- `server/models/systemSettings.js`
- `server/utils/agents/imported.js`
- `server/utils/agentFlows/index.js`
- `server/utils/MCP/index.js`

## Frontend Sources

- `frontend/src/pages/Admin/Agents/index.jsx`
- `frontend/src/pages/Admin/Agents/skills.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/skillRegistry.js`

## Default Built-In Skills

`DEFAULT_SKILLS` in `defaults.js` contains:

- `rag-memory`
- `document-summarizer`
- `web-scraping`

These are enabled unless their names appear in `disabled_agent_skills`.

## Configurable Built-In Skills

Optional skills are stored in `default_agent_skills`.

Current configurable skills include:

- `filesystem-agent`
- `create-files-agent`
- `create-chart`
- `web-browsing`
- `sql-agent`
- `gmail-agent`
- `google-calendar-agent`
- `outlook-agent`

`agentSkillsFromSystemSettings` loads these from system settings and filters unavailable or disabled sub-skills.

## Availability Checks

`SKILL_FILTER_CONFIG` checks runtime availability for selected parent skills:

- `filesystem-agent`: `plugins/filesystem/lib.isToolAvailable()`
- `create-files-agent`: `plugins/create-files/lib.isToolAvailable()`
- `gmail-agent`: `GmailBridge.isToolAvailable()`
- `outlook-agent`: `OutlookBridge.isToolAvailable()`

Frontend also checks:

- `GET /agent-skills/filesystem-agent/is-available`
- `GET /agent-skills/create-files-agent/is-available`

## Sub-Skills

Parent skills with child tools are represented as:

```text
parent-skill#child-tool
```

Examples:

- `filesystem-agent#read-text-file`
- `create-files-agent#create-docx-file`
- `gmail-agent#gmail-send-email`

Disabled sub-skills live in system settings, for example:

- `disabled_filesystem_skills`
- `disabled_create_files_skills`
- `disabled_gmail_skills`
- `disabled_google_calendar_skills`
- `disabled_outlook_skills`

Frontend centralizes sub-skill metadata in `skillRegistry.js`.

Current backend nuance: `disabled_google_calendar_skills` is defined in
`SystemSettings` and the frontend registry, but `server/utils/agents/defaults.js`
does not currently include `google-calendar-agent` in `SKILL_FILTER_CONFIG`.
That means Google Calendar sub-skill disabling is not enforced by the same
backend filtering path as filesystem, create-files, Gmail, and Outlook.

## Imported Skills

Imported custom skills are active when their `plugin.json` has `active: true`. `ImportedPlugin.activeImportedPlugins()` returns identifiers in this shape:

```text
@@<hubId>
```

The handler later resolves that into a runtime plugin.

## Agent Flows

`AgentFlows.activeFlowPlugins()` returns:

```text
@@flow_<uuid>
```

Only flows with `active !== false` are included.

## MCP Tools

`MCPCompatibilityLayer.activeMCPServers()` starts MCP servers and returns:

```text
@@mcp_<serverName>
```

The handler later expands this into one tool per unsuppressed MCP tool.

## Admin Save Flow

`AdminAgents.handleSubmit` writes:

- `default_agent_skills`
- `disabled_agent_skills`
- skill-specific settings
- environment settings where needed

The active flow state is stored in each flow JSON via `POST /agent-flows/:uuid/toggle`, not by the hidden `active_agent_flows` field.

## Rebuild Checklist

- Define a stable plugin registry.
- Store default-disabled and optional-enabled skill lists.
- Represent child tools with `parent#child`.
- Build one function that returns all enabled tool identifiers for an agent run.
- Resolve dynamic identifiers later during handler setup.
- Mirror backend skill metadata in the frontend admin UI.
