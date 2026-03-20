import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../lib/node-interface';

export interface ElevenLabsNodeParams {
  name?: string;
  textRef: string; // Reference to text source
  voice?: string;
  model?: string;
}

/**
 * ElevenLabs Node - Text-to-speech using ElevenLabs API
 */
export class ElevenLabsNode implements INode {
  constructor(private params: ElevenLabsNodeParams) {}

  public getType(): string {
    return 'elevenlabs';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [
      {
        name: 'text',
        description: 'Text to convert to speech',
      },
    ];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'audio',
        description: 'Generated speech audio',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.textRef) {
      errors.push({
        text: 'ElevenLabs node requires a text reference',
        field: 'textRef',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'textRef',
        required: true,
        description: 'Text source reference',
        type: 'reference',
      },
      {
        name: 'voice',
        required: false,
        description: 'Voice ID to use',
        type: 'string',
      },
      {
        name: 'model',
        required: false,
        description: 'ElevenLabs model to use',
        type: 'string',
      },
    ];
  }
}
