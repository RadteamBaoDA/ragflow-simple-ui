import assert from 'node:assert/strict';
import { mkdtemp, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createOfficeDocumentTool } from '../src/officeCliTool.js';
import type { OfficeCliProcessRunner } from '../src/types.js';

test('executes an allowlisted OfficeCLI operation with the file before operation arguments', async () => {
  const workspace = await realpath(await mkdtemp(path.join(os.tmpdir(), 'doc-tools-')));
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const runner: OfficeCliProcessRunner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return { exitCode: 0, stdout: 'valid', stderr: '' };
  };
  const tool = createOfficeDocumentTool({ workspace, officeCliPath: 'officecli', runner });

  const result = await tool.execute({
    operation: 'validate',
    file: 'report.docx',
    arguments: [],
  });

  assert.deepEqual(result, { ok: true, exitCode: 0, stdout: 'valid', stderr: '' });
  assert.deepEqual(calls, [
    {
      command: 'officecli',
      args: ['validate', path.join(workspace, 'report.docx')],
      cwd: workspace,
    },
  ]);
});

test('rejects a document path outside the bound workspace before process execution', async () => {
  const workspace = await realpath(await mkdtemp(path.join(os.tmpdir(), 'doc-tools-')));
  let executed = false;
  const runner: OfficeCliProcessRunner = async () => {
    executed = true;
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const tool = createOfficeDocumentTool({ workspace, officeCliPath: 'officecli', runner });

  const result = await tool.execute({
    operation: 'create',
    file: '../outside.docx',
    arguments: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'PATH_OUTSIDE_WORKSPACE');
  assert.equal(executed, false);
});
