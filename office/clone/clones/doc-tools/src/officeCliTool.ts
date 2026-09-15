import { access, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import type { FunctionTool } from 'openai/resources/responses/responses';
import type {
  OfficeCliOperation,
  OfficeCliProcessRunner,
  OfficeDocumentTool,
  OfficeDocumentToolInput,
  OfficeDocumentToolResult,
} from './types.js';

// TypeScript port of AionCore's aionui-office OfficeCLI boundary. The preview
// process lifecycle is intentionally excluded from this document-agent sample.
const OPERATIONS: readonly OfficeCliOperation[] = [
  'create',
  'open',
  'close',
  'get',
  'query',
  'view',
  'validate',
  'add',
  'set',
  'remove',
  'move',
  'copy',
];

export const OFFICE_DOCUMENT_TOOL: FunctionTool = {
  type: 'function',
  name: 'office_document',
  description: 'Create, inspect, edit, validate, and render DOCX, XLSX, or PPTX files with OfficeCLI.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      operation: {
        type: 'string',
        enum: OPERATIONS,
        description: 'The allowlisted OfficeCLI verb.',
      },
      file: {
        type: 'string',
        description: 'A document path relative to the workspace.',
      },
      arguments: {
        type: 'array',
        items: { type: 'string' },
        description: 'OfficeCLI arguments after the document path, without a shell command.',
      },
    },
    required: ['operation', 'file', 'arguments'],
  },
};

const isWithin = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

async function resolveDocumentPath(workspace: string, file: string): Promise<string> {
  if (!file.trim() || path.isAbsolute(file)) throw new Error('PATH_OUTSIDE_WORKSPACE');
  const candidate = path.resolve(workspace, file);
  if (!isWithin(workspace, candidate)) throw new Error('PATH_OUTSIDE_WORKSPACE');

  const existingBoundary = await realpath(candidate).catch(() => realpath(path.dirname(candidate)));
  if (!isWithin(workspace, existingBoundary)) throw new Error('PATH_OUTSIDE_WORKSPACE');
  return candidate;
}

export const runOfficeCli: OfficeCliProcessRunner = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), options.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.once('error', reject);
    child.once('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });

async function fileExists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

export async function resolveOfficeCliPath(): Promise<string | undefined> {
  const executable = process.platform === 'win32' ? 'officecli.exe' : 'officecli';
  for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, executable);
    if (await fileExists(candidate)) return candidate;
  }

  const known =
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'OfficeCli', 'officecli.exe')
      : process.env.HOME
        ? path.join(process.env.HOME, '.local', 'bin', 'officecli')
        : undefined;
  return known && (await fileExists(known)) ? known : undefined;
}

export function createOfficeDocumentTool(options: {
  workspace: string;
  officeCliPath?: string;
  runner?: OfficeCliProcessRunner;
  timeoutMs?: number;
}): OfficeDocumentTool {
  const runner = options.runner ?? runOfficeCli;

  return {
    definition: OFFICE_DOCUMENT_TOOL,
    async execute(input: OfficeDocumentToolInput): Promise<OfficeDocumentToolResult> {
      try {
        if (!OPERATIONS.includes(input.operation)) throw new Error('OPERATION_NOT_ALLOWED');
        if (!Array.isArray(input.arguments) || input.arguments.some((value) => typeof value !== 'string')) {
          throw new Error('INVALID_ARGUMENTS');
        }

        const workspace = await realpath(options.workspace);
        const documentPath = await resolveDocumentPath(workspace, input.file);
        const command = options.officeCliPath ?? (await resolveOfficeCliPath());
        if (!command) throw new Error('OFFICECLI_NOT_FOUND');

        const result = await runner(command, [input.operation, documentPath, ...input.arguments], {
          cwd: workspace,
          timeoutMs: options.timeoutMs ?? 120_000,
        });
        return { ok: result.exitCode === 0, ...result };
      } catch (error) {
        const code = error instanceof Error ? error.message : 'OFFICECLI_EXECUTION_FAILED';
        return { ok: false, error: { code, message: code } };
      }
    },
  };
}
