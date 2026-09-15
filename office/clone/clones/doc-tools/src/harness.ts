import { OFFICE_DOCUMENT_TOOL } from './officeCliTool.js';
import { loadDocumentSkills } from './skills.js';
import type {
  DocumentFormat,
  DocumentUseCase,
  OfficeDocumentToolInput,
  OfficeDocumentToolResult,
  ResponseFunctionCall,
  ResponsesClient,
} from './types.js';

const isFunctionCall = (item: { type: string }): item is ResponseFunctionCall => item.type === 'function_call';

export async function runDocumentAgent(input: {
  client: ResponsesClient;
  model: string;
  prompt: string;
  format: DocumentFormat;
  useCase: DocumentUseCase;
  execute(toolInput: OfficeDocumentToolInput): Promise<OfficeDocumentToolResult>;
  maxToolRounds?: number;
}): Promise<string> {
  const skillInstructions = await loadDocumentSkills(input);
  const instructions = [
    'You are a document agent. Use only the office_document tool for Office file operations.',
    'Inspect when uncertain, validate the final file, and render HTML after major layout changes.',
    skillInstructions,
  ].join('\n\n');
  const baseRequest = {
    model: input.model,
    instructions,
    tools: [OFFICE_DOCUMENT_TOOL],
    tool_choice: 'auto',
    parallel_tool_calls: false,
  };

  let response = await input.client.create({ ...baseRequest, input: input.prompt });
  const maxToolRounds = input.maxToolRounds ?? 20;

  for (let round = 0; round < maxToolRounds; round += 1) {
    const calls = response.output.filter(isFunctionCall);
    if (calls.length === 0) return response.output_text;

    const outputs = [];
    for (const call of calls) {
      let result: OfficeDocumentToolResult;
      try {
        result = await input.execute(JSON.parse(call.arguments) as OfficeDocumentToolInput);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid tool input';
        result = { ok: false, error: { code: 'INVALID_TOOL_INPUT', message } };
      }
      outputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await input.client.create({
      ...baseRequest,
      previous_response_id: response.id,
      input: outputs,
    });
  }

  throw new Error(`Document agent exceeded ${maxToolRounds} tool rounds`);
}
