import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { stabilityResponseSchema, type Capability } from '@harness/capabilities';
import type { ImageProvider, ProviderInvocation } from '../image-provider.js';

const STABILITY_BEDROCK_REGION = 'us-west-2' as const;

function createStabilityBedrockRuntimeClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: STABILITY_BEDROCK_REGION,
    maxAttempts: 1,
  });
}

function bedrockInvocationId(capability: Capability): string {
  const invocation = capability.invocation;
  if (invocation.kind === 'foundation-model') return invocation.modelId;
  if (invocation.kind === 'geo-inference-profile') return invocation.profileId;
  throw new Error(`${capability.name} is not an Amazon Bedrock target`);
}

export class StabilityBedrockAdapter implements ImageProvider {
  readonly #client: BedrockRuntimeClient;
  /** Bedrock reads the ambient AWS credential chain, which only a live call can confirm. */
  readonly configured = true;

  constructor(client = createStabilityBedrockRuntimeClient()) {
    this.#client = client;
  }

  async invoke(
    capability: Capability,
    request: Record<string, unknown>,
  ): Promise<ProviderInvocation> {
    const invocationId = bedrockInvocationId(capability);
    const response = await this.#client.send(
      new InvokeModelCommand({
        modelId: invocationId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify(request)),
      }),
    );
    const decoded = stabilityResponseSchema.parse(
      JSON.parse(new TextDecoder().decode(response.body)),
    );
    const filtered = decoded.finish_reasons.find((reason) => reason !== null);
    if (filtered) throw new Error(filtered);
    const images = decoded.images ?? [];
    if (images.length === 0) throw new Error('Provider response contained no image output');
    const requestId = response.$metadata.requestId;
    return {
      invocationId,
      images: images.map((base64, index) => ({
        base64,
        seed: decoded.seeds?.[index] ?? decoded.seeds?.[0] ?? null,
        finishReason: decoded.finish_reasons[index] ?? null,
      })),
      ...(requestId ? { requestId } : {}),
      metadata: {
        httpStatusCode: response.$metadata.httpStatusCode ?? null,
        attempts: response.$metadata.attempts ?? null,
      },
    };
  }
}
