import type { MediaType } from '@harness/contracts';
import type { FastifyReply } from 'fastify';

export function sendImmutableImage(reply: FastifyReply, mediaType: MediaType, bytes: Uint8Array) {
  return reply
    .header('content-type', mediaType)
    .header('content-length', String(bytes.byteLength))
    .header('cache-control', 'private, max-age=31536000, immutable')
    .send(Buffer.from(bytes));
}
