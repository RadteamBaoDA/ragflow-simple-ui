import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AgenticError,
  NodeAppendLogSessionStore,
  runSessionRecoveryPrefixConformance,
  runSessionStoreConformance,
} from "../src/index.ts";

const seed = {
  model: { provider: "test", model: "fake" }, thinkingLevel: "off" as const, activeToolNames: [],
};

test("node append-log backend passes reusable session conformance after reopen", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "agentic-log-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let index = 0;
  const failures = await runSessionStoreConformance(() => new NodeAppendLogSessionStore(join(directory, String(++index))));
  assert.deepEqual(failures, []);
});

test("node append-log backend reopens every durable operation prefix", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "agentic-prefix-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.deepEqual(await runSessionRecoveryPrefixConformance({
    writer: new NodeAppendLogSessionStore(directory),
    reopen: () => new NodeAppendLogSessionStore(directory),
  }), []);
});

test("node append-log backend ignores only a torn final record", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "agentic-torn-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new NodeAppendLogSessionStore(directory);
  await store.create({ sessionId: "torn", seedConfiguration: seed });
  await store.append("torn", 0, [{ type: "entry_added", entry: { id: "root", parentId: null, kind: "user", data: {} } }]);
  await appendFile(join(directory, "torn.jsonl"), '{"kind":"batch","broken"');
  assert.equal((await new NodeAppendLogSessionStore(directory).load("torn"))?.record.version, 1);
});

test("node append-log backend rejects a malformed interior record", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "agentic-corrupt-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new NodeAppendLogSessionStore(directory);
  await store.create({ sessionId: "corrupt", seedConfiguration: seed });
  const path = join(directory, "corrupt.jsonl");
  const content = await readFile(path, "utf8");
  await writeFile(path, `${content}{"kind":"broken"}\n`);
  await assert.rejects(() => new NodeAppendLogSessionStore(directory).load("corrupt"), (error) =>
    error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
});
