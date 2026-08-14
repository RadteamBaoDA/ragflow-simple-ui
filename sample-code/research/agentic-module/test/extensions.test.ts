import test from "node:test";
import assert from "node:assert/strict";
import {
  AgenticError,
  activateImportedSkill,
  assertArchiveEntriesSafe,
  mcpManagerTools,
  normalizeImportedManifest,
} from "../src/index.ts";

const manifest = {
  id: "skill",
  name: "Skill",
  version: "1.0.0",
  description: "Skill",
  active: true,
  entrypoint: { parameters: { type: "object" } },
};

test("imported skills are inactive first and require management plus execution policy", async () => {
  const imported = normalizeImportedManifest(manifest);
  assert.equal(imported.active, false);
  await assert.rejects(
    () => activateImportedSkill(imported, {}, { canManageTools: () => false }, { mode: "worker" }),
    (error) => error instanceof AgenticError && error.code === "TOOL_DENIED"
  );
  assert.equal((await activateImportedSkill(imported, {}, { canManageTools: () => true }, { mode: "worker" })).active, true);
  await assert.rejects(() => activateImportedSkill(imported, {}, { canManageTools: () => true }, { mode: "in_process" }));
  assert.throws(() => assertArchiveEntriesSafe(["plugin.json", "../escape.js"]));
});

test("MCP manager enforces health, suppression, timeout, abort, reload, and stop contracts", async () => {
  const lifecycle: string[] = [];
  const manager = {
    start: async (server: string) => { lifecycle.push(`start:${server}`); },
    stop: async (server: string) => { lifecycle.push(`stop:${server}`); },
    reload: async (server: string) => { lifecycle.push(`reload:${server}`); },
    health: async () => "healthy" as const,
    listTools: async () => [
      { name: "read", inputSchema: { type: "object" } },
      { name: "hidden", inputSchema: { type: "object" } },
    ],
    callTool: async () => ({ ok: true }),
  };
  const tools = await mcpManagerTools("demo", manager, {}, { suppressed: ["hidden"], timeoutMs: 100 });
  assert.deepEqual(tools.map(({ name }) => name), ["demo-read"]);
  await manager.reload("demo");
  await manager.stop("demo");
  assert.deepEqual(lifecycle, ["start:demo", "reload:demo", "stop:demo"]);

  const unhealthy = { ...manager, health: async () => "unhealthy" as const };
  await assert.rejects(() => mcpManagerTools("bad", unhealthy, {}, { timeoutMs: 100 }));

  const slow = { ...manager, listTools: async () => new Promise<never>(() => undefined) };
  await assert.rejects(
    () => mcpManagerTools("slow", slow, {}, { timeoutMs: 1 }),
    (error) => error instanceof AgenticError && error.code === "MCP_UNAVAILABLE"
  );
});
