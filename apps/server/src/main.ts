import { buildApp } from './app.js';

const port = Number.parseInt(process.env['HARNESS_PORT'] ?? '4173', 10);
const app = await buildApp();

try {
  await app.listen({ host: '127.0.0.1', port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
