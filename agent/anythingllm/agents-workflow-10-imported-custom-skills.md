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

The base path is `server/storage/plugins/agent-skills` in development and
`$STORAGE_DIR/plugins/agent-skills` in production (`pluginsPath` in
`imported.js`).

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

`entrypoint` requires both `file` and `params`; `entrypoint.params` becomes the JSON schema properties for the tool.

`setup_args` define admin-configurable values that are passed into the handler as runtime arguments. `parseCallOptions` resolves each argument as `value || default || null`; a missing required value is only logged, not fatal.

## Handler Loading

`ImportedPlugin.loadPluginByHubId(hubId)`:

1. Resolves `plugin.json` inside the plugin folder.
2. Validates the path is inside `pluginsPath`.
3. Reads manifest JSON.
4. Creates an `ImportedPlugin` instance, whose constructor deletes the Node
   require cache for `handler.js` and then requires it.

The cache deletion lets updated custom skills reload without restarting the server.

There is no sandbox: `handler.js` is required directly into the server's Node
process and runs with its privileges.

## Active Skill Discovery

`ImportedPlugin.activeImportedPlugins()` scans skill folders and returns:

```text
@@<hubId>
```

for every manifest with `active: true`.

During agent setup, `#attachPlugins` (`server/utils/agents/index.js`, mirrored in `ephemeral.js`) resolves `@@<hubId>` into the actual imported plugin, first checking that `handler.js` exists via `validateImportedPluginHandler`.

## Runtime Tool Shape

Imported plugins register an `aibitat.function` with:

- `name`: hub ID
- `description`: manifest description
- `parameters`: manifest `entrypoint.params`
- `runtimeArgs`: parsed setup args
- `examples`: manifest `examples` (or `[]`)
- `logger`
- `introspect`
- `webScraper`
- the members of `module.exports.runtime` from `handler.js` (including its `handler` function)
- `requestToolApproval`

The `runtime: "docker"` property on the registered function is a label only; nothing is containerized.

The imported skill's handler cannot override `requestToolApproval`; the loader appends it after spreading custom functions. When no approval channel exists on the aibitat instance (for example scheduled agent runs), `requestToolApproval` resolves approved so the skill still runs.

## Importing From Community Hub

`importCommunityItemFromUrl` (called from `CommunityHub.importBundleItem` in `server/models/communityHub.js`):

1. Verifies the community item's manifest file list includes `plugin.json`.
2. Downloads the zip into the agent-skills directory.
3. Validates every zip entry stays inside the target plugin folder (Zip Slip guard).
4. Extracts files.
5. Rewrites `plugin.json` with `active: false` and the correct `hubId`.
6. Deletes the zip (in a `finally` block, even on failure).

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
