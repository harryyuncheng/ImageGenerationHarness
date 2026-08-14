import { describe, expect, it } from 'vitest';
import {
  destinationSchema,
  generatedImageSidecarSchema,
  projectAssetSchema,
  referenceImageSchema,
} from '../src/index.js';

describe('local domain contracts', () => {
  it('rejects repository traversal and cloud coordinates', () => {
    const now = new Date().toISOString();
    expect(() =>
      referenceImageSchema.parse({
        schemaVersion: 1,
        folderId: crypto.randomUUID(),
        imageId: crypto.randomUUID(),
        name: 'window-light.jpg',
        repositoryRelativePath: '../outside.jpg',
        sha256: 'a'.repeat(64),
        mediaType: 'image/jpeg',
        byteLength: 1024,
        width: 1200,
        height: 800,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it('requires project assets to have a parent project', () => {
    const now = new Date().toISOString();
    expect(() =>
      projectAssetSchema.parse({
        schemaVersion: 1,
        assetId: crypto.randomUUID(),
        name: 'Hero costume',
        description: '',
        directory: 'projects/example/assets/hero',
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
    expect(destinationSchema.parse({ kind: 'main' })).toEqual({ kind: 'main' });
  });

  it('keeps generated metadata strict and forbids base64 or absolute-path expansion', () => {
    const now = new Date().toISOString();
    const base = {
      schemaVersion: 1,
      imageId: crypto.randomUUID(),
      repositoryRelativePath: 'images/output.png',
      createdAt: now,
      runId: crypto.randomUUID(),
      jobId: crypto.randomUUID(),
      attemptId: crypto.randomUUID(),
      capabilityRegistryVersion: 'test',
      canonicalTargetId: 'generation/core',
      invocationId: 'model',
      prompt: 'A lighthouse',
      normalizedRequest: { prompt: 'A lighthouse' },
      seed: { strategy: 'provider-random', planned: null, provider: 1 },
      output: {
        format: 'png',
        mediaType: 'image/png',
        width: 64,
        height: 64,
        byteLength: 100,
        sha256: 'a'.repeat(64),
      },
      inputs: [],
      provider: { finishReason: null, metadata: {} },
    } as const;
    expect(generatedImageSidecarSchema.parse(base).prompt).toBe('A lighthouse');
    expect(() => generatedImageSidecarSchema.parse({ ...base, base64: 'secret' })).toThrow();
    expect(() =>
      generatedImageSidecarSchema.parse({ ...base, repositoryRelativePath: '/tmp/output.png' }),
    ).toThrow();
  });
});
