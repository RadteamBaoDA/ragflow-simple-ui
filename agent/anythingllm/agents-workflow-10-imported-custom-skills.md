# Workflow 10: Imported Custom Skills

## Goal

Load community or custom agent skills from disk and expose active skills as normal agent tools.

## Key Files

- `server/utils/agents/imported.js`
- `server/utils/agents/imported-manifest.schema.json`
- `server/endpoints/experimental/imported-agent-plugins.js`
- `server/models/communityHub.js`
- `frontend/src/pages/Admin/Agents/Imported`
- `frontend/src/pages/GeneralSettings/CommunityHub`

## Storage

Imported skills live under:

```text
storage/plugins/agent-skills/<hubId>/
```

Required files:

- `plugin.json`
- `handler.js`

## Manifest

`plugin.json` must include:

- `active`
- `hubId`
- `name`
- `schema`
- `version`
- `description`
- `entrypoint`
- `imported: true`

`entrypoint.params` becomes the JSON schema properties for the tool.

`setup_args` define admin-configurable values that are passed into the handler as runtime arguments.

## Handler Loading

`ImportedPlugin.loadPluginByHubId(hubId)`:

1. Resolves `plugin.json` inside the plugin folder.
2. Validates the path is inside `pluginsPath`.
3. Reads manifest JSON.
4. Deletes the Node require cache for `handler.js`.
5. Requires `handler.js`.
6. Creates an `ImportedPlugin` instance.

The cache deletion lets updated custom skills reload without restarting the server.

## Active Skill Discovery

`ImportedPlugin.activeImportedPlugins()` scans skill folders and returns:

```text
@@<hubId>
```

for every manifest with `active: true`.

During agent setup, `#attachPlugins` resolves `@@<hubId>` into the actual imported plugin.

## Runtime Tool Shape

Imported plugins register an `aibitat.function` with:

- `name`: hub ID
- `description`: manifest description
- `parameters`: manifest `entrypoint.params`
- `runtimeArgs`: parsed setup args
- `logger`
- `introspect`
- `webScraper`
- custom handler exports from `handler.js`
- `requestToolApproval`

The imported skill's handler cannot override `requestToolApproval`; the loader appends it after spreading custom functions.

## Importing From Community Hub

`importCommunityItemFromUrl`:

1. Downloads a zip into the agent-skills directory.
2. Verifies the zip contains `plugin.json`.
3. Validates every zip entry stays inside the target plugin folder.
4. Extracts files.
5. Sets `active: false` and `hubId`.
6. Deletes the zip.

## Admin Endpoints

- `POST /experimental/agent-plugins/:hubId/toggle`
- `POST /experimental/agent-plugins/:hubId/config`
- `DELETE /experimental/agent-plugins/:hubId`

All require admin access.

## Rebuild Checklist

- Define a manifest schema.
- Load only from a controlled plugin directory.
- Prevent path traversal on read and extraction.
- Convert manifest parameters into tool schema.
- Pass setup args into runtime handlers.
- Make active custom skills part of the same tool discovery pipeline as built-ins.
