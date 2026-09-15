import assert from 'node:assert/strict';
import test from 'node:test';

import { loadDocumentSkills } from '../src/skills.js';

test('loads the format skill before the selected use-case skill', async () => {
  const instructions = await loadDocumentSkills({
    format: 'docx',
    useCase: 'word-report-proposal',
  });

  assert.match(instructions, /<document-format-skill name="officecli-docx">/);
  assert.match(instructions, /<document-use-case-skill name="word-report-proposal">/);
  assert.ok(instructions.indexOf('officecli-docx') < instructions.indexOf('word-report-proposal'));
});

test('rejects a use case that does not support the selected format', async () => {
  await assert.rejects(
    loadDocumentSkills({ format: 'xlsx', useCase: 'academic-paper' }),
    /does not support format xlsx/,
  );
});
