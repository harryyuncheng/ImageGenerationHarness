import { InvokeModelCommand, type BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it, vi } from 'vitest';
import {
  createStabilityBedrockRuntimeClient,
  StabilityBedrockAdapter,
  STABILITY_BEDROCK_REGION,
} from './bedrock.js';

describe('direct Bedrock adapter', () => {
  it('uses the only Bedrock region that supports every registered Stability target', async () => {
    const client = createStabilityBedrockRuntimeClient();

    expect(await client.config.region()).toBe(STABILITY_BEDROCK_REGION);

    client.destroy();
  });

  it('sends the exact JSON payload and returns only non-secret response metadata', async () => {
    const send = vi.fn((command: InvokeModelCommand) => {
      expect(command).toBeInstanceOf(InvokeModelCommand);
      expect(command.input).toMatchObject({
        modelId: 'stability.test-model-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
      });
      const body = command.input.body;
      if (!(body instanceof Uint8Array)) throw new Error('Expected a byte request body');
      expect(JSON.parse(new TextDecoder().decode(body))).toEqual({
        prompt: '  exact prompt  ',
        seed: 42,
      });
      return Promise.resolve({
        body: new TextEncoder().encode('{"finish_reasons":[null],"images":["AA=="]}'),
        $metadata: { requestId: 'request-123', httpStatusCode: 200, attempts: 1 },
      });
    });
    const adapter = new StabilityBedrockAdapter({ send } as unknown as BedrockRuntimeClient);

    const result = await adapter.invoke('stability.test-model-v1:0', {
      prompt: '  exact prompt  ',
      seed: 42,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(new TextDecoder().decode(result.body)).toContain('finish_reasons');
    expect(result).toMatchObject({
      requestId: 'request-123',
      metadata: { httpStatusCode: 200, attempts: 1 },
    });
    expect(JSON.stringify(result)).not.toMatch(/credential|authorization|token/iu);
  });
});
