import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';

export interface AIMusicAPINodeParams {
  name?: string;
  prompt: string;
  model?: string;
}

/**
 * AI Music API Node - Generates music using AI Music API
 */
export class AIMusicAPINode implements INode {
  constructor(private params: AIMusicAPINodeParams) {}

  public getType(): string {
    return 'ai_music_api_ai';
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
        name: 'audio',
        description: 'Generated audio file',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.prompt || this.params.prompt.trim() === '') {
      errors.push({
        text: 'AI Music API node requires a prompt',
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
        description: 'Music generation prompt',
        type: 'string',
      },
      {
        name: 'model',
        required: false,
        description: 'AI model to use',
        type: 'string',
      },
    ];
  }
}
