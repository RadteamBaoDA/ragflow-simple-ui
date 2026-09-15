import type { FunctionTool } from 'openai/resources/responses/responses';

export type DocumentFormat = 'docx' | 'xlsx' | 'pptx';

export type DocumentUseCase =
  | 'word-report-proposal'
  | 'word-form-contract'
  | 'academic-paper'
  | 'excel-dashboard'
  | 'financial-model'
  | 'sales-budget-tracker'
  | 'powerpoint-presentation'
  | 'pitch-deck'
  | 'morph-ppt'
  | 'edit-existing-office-file'
  | 'analyze-validate-office-file'
  | 'preview-human-review-repair';

export type OfficeCliOperation =
  | 'create'
  | 'open'
  | 'close'
  | 'get'
  | 'query'
  | 'view'
  | 'validate'
  | 'add'
  | 'set'
  | 'remove'
  | 'move'
  | 'copy';

export type OfficeDocumentToolInput = {
  operation: OfficeCliOperation;
  file: string;
  arguments: string[];
};

export type OfficeDocumentToolResult = {
  ok: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: {
    code: string;
    message: string;
  };
};

export type OfficeCliProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type OfficeCliProcessRunner = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number },
) => Promise<OfficeCliProcessResult>;

export type OfficeDocumentTool = {
  definition: FunctionTool;
  execute(input: OfficeDocumentToolInput): Promise<OfficeDocumentToolResult>;
};

export type ResponseFunctionCall = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};

export type AgentResponse = {
  id: string;
  output_text: string;
  output: Array<ResponseFunctionCall | { type: string }>;
};

export type ResponsesClient = {
  create(request: Record<string, unknown>): Promise<AgentResponse>;
};
