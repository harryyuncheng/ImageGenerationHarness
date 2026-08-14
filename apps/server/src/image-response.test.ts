import { decodeCanonicalBase64 } from '@harness/image';
import { describe, expect, it } from 'vitest';

describe('provider image response decoding', () => {
  it('validates large canonical base64 without exhausting the call stack', () => {
    const source = Buffer.alloc(4 * 1024 * 1024, 0xa5);
    const decoded = decodeCanonicalBase64(source.toString('base64'));

    expect(decoded.byteLength).toBe(source.byteLength);
    expect(decoded[0]).toBe(0xa5);
    expect(decoded.at(-1)).toBe(0xa5);
  });

  it.each(['AA=A', '!!!!', 'AA', 'A==='])('rejects non-canonical base64: %s', (value) => {
    expect(() => decodeCanonicalBase64(value)).toThrow('Image data is not valid base64');
  });
});
