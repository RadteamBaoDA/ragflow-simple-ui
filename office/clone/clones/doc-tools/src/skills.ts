import { readFile } from 'node:fs/promises';

import type { DocumentFormat, DocumentUseCase } from './types.js';

const FORMAT_SKILLS: Record<DocumentFormat, string> = {
  docx: 'formats/docx.md',
  xlsx: 'formats/xlsx.md',
  pptx: 'formats/pptx.md',
};

const USE_CASE_SKILLS: Record<DocumentUseCase, { file: string; formats: readonly DocumentFormat[] }> = {
  'word-report-proposal': { file: 'use-cases/word/word-report-proposal.md', formats: ['docx'] },
  'word-form-contract': { file: 'use-cases/word/word-form-contract.md', formats: ['docx'] },
  'academic-paper': { file: 'use-cases/word/academic-paper.md', formats: ['docx'] },
  'excel-dashboard': { file: 'use-cases/excel/excel-dashboard.md', formats: ['xlsx'] },
  'financial-model': { file: 'use-cases/excel/financial-model.md', formats: ['xlsx'] },
  'sales-budget-tracker': { file: 'use-cases/excel/sales-budget-tracker.md', formats: ['xlsx'] },
  'powerpoint-presentation': {
    file: 'use-cases/powerpoint/powerpoint-presentation.md',
    formats: ['pptx'],
  },
  'pitch-deck': { file: 'use-cases/powerpoint/pitch-deck.md', formats: ['pptx'] },
  'morph-ppt': { file: 'use-cases/powerpoint/morph-ppt.md', formats: ['pptx'] },
  'edit-existing-office-file': {
    file: 'use-cases/shared/edit-existing-office-file.md',
    formats: ['docx', 'xlsx', 'pptx'],
  },
  'analyze-validate-office-file': {
    file: 'use-cases/shared/analyze-validate-office-file.md',
    formats: ['docx', 'xlsx', 'pptx'],
  },
  'preview-human-review-repair': {
    file: 'use-cases/shared/preview-human-review-repair.md',
    formats: ['docx', 'xlsx', 'pptx'],
  },
};

const readSkill = (relativePath: string): Promise<string> =>
  readFile(new URL(`../skills/${relativePath}`, import.meta.url), 'utf8');

export async function loadDocumentSkills(input: {
  format: DocumentFormat;
  useCase: DocumentUseCase;
}): Promise<string> {
  const useCase = USE_CASE_SKILLS[input.useCase];
  if (!useCase.formats.includes(input.format)) {
    throw new Error(`Use case ${input.useCase} does not support format ${input.format}`);
  }

  const [formatSkill, useCaseSkill] = await Promise.all([
    readSkill(FORMAT_SKILLS[input.format]),
    readSkill(useCase.file),
  ]);

  return [
    `<document-format-skill name="officecli-${input.format}">\n${formatSkill.trim()}\n</document-format-skill>`,
    `<document-use-case-skill name="${input.useCase}">\n${useCaseSkill.trim()}\n</document-use-case-skill>`,
  ].join('\n\n');
}
