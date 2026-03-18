import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';

export interface OpenAINodeParams {
  name?: string;
  prompt: string;
  model?: string;
}

/**
 * OpenAI Node - Text generation using OpenAI API
 */
export class OpenAINode implements INode {
  constructor(private params: OpenAINodeParams) {}

  public getType(): string {
    return 'openai';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'text',
        description: 'Generated text',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.prompt || this.params.prompt.trim() === '') {
      errors.push({
        text: 'OpenAI node requires a prompt',
        field: 'prompt',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'prompt',
        required: true,
        description: 'Text generation prompt',
        type: 'string',
      },
      {
        name: 'model',
        required: false,
        description: 'OpenAI model to use (e.g., gpt-4, gpt-3.5-turbo)',
        type: 'string',
      },
    ];
  }
}
