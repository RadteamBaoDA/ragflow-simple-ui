import assert from 'node:assert/strict';
import test from 'node:test';

import { runDocumentAgent } from '../src/harness.js';
import type { OfficeDocumentToolInput, OfficeDocumentToolResult, ResponsesClient } from '../src/types.js';

test('returns OfficeCLI output to the model and finishes with model text', async () => {
  const requests: unknown[] = [];
  const client: ResponsesClient = {
    async create(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: 'resp-1',
          output_text: '',
          output: [
            {
              type: 'function_call',
              call_id: 'call-1',
              name: 'office_document',
              arguments: JSON.stringify({ operation: 'validate', file: 'report.docx', arguments: [] }),
            },
          ],
        };
      }
      return { id: 'resp-2', output_text: 'Document validated.', output: [] };
    },
  };
  const calls: OfficeDocumentToolInput[] = [];
  const execute = async (input: OfficeDocumentToolInput): Promise<OfficeDocumentToolResult> => {
    calls.push(input);
    return { ok: true, exitCode: 0, stdout: 'valid', stderr: '' };
  };

  const result = await runDocumentAgent({
    client,
    model: 'test-model',
    prompt: 'Validate report.docx',
    format: 'docx',
    useCase: 'analyze-validate-office-file',
    execute,
  });

  assert.equal(result, 'Document validated.');
  assert.deepEqual(calls, [{ operation: 'validate', file: 'report.docx', arguments: [] }]);
  assert.deepEqual((requests[1] as { input: unknown }).input, [
    {
      type: 'function_call_output',
      call_id: 'call-1',
      output: JSON.stringify({ ok: true, exitCode: 0, stdout: 'valid', stderr: '' }),
    },
  ]);
});
