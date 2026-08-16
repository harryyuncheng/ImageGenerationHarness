import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const STABILITY_BEDROCK_REGION = 'us-west-2' as const;

function createStabilityBedrockRuntimeClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: STABILITY_BEDROCK_REGION,
    maxAttempts: 1,
  });
}

export interface BedrockInvocationResult {
  body: Uint8Array;
  requestId?: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface BedrockInvoker {
  invoke(modelId: string, payload: unknown): Promise<BedrockInvocationResult>;
}

export class StabilityBedrockAdapter implements BedrockInvoker {
  readonly #client: BedrockRuntimeClient;

  constructor(client = createStabilityBedrockRuntimeClient()) {
    this.#client = client;
  }

  async invoke(modelId: string, payload: unknown): Promise<BedrockInvocationResult> {
    const response = await this.#client.send(
      new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify(payload)),
      }),
    );
    const requestId = response.$metadata.requestId;
    return {
      body: response.body,
      ...(requestId ? { requestId } : {}),
      metadata: {
        httpStatusCode: response.$metadata.httpStatusCode ?? null,
        attempts: response.$metadata.attempts ?? null,
      },
    };
  }
}
