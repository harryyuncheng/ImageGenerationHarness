import helmet from '@fastify/helmet';
import type { RepositoryStatus } from '@harness/domain';
import fastify, { type FastifyInstance } from 'fastify';
import { registerCapabilityRoutes } from '../capabilities/routes.js';
import { registerImageRoutes } from '../images/routes.js';
import { LocalPresetService } from '../presets/preset-service.js';
import { registerPresetRoutes } from '../presets/routes.js';
import {
  getDefaultLocalRepositoryManager,
  type LocalRepositoryManager,
} from '../repository/repository-manager.js';
import { LocalStyleGuideService } from '../style-guide/style-guide-service.js';
import { registerStyleGuideRoutes } from '../style-guide/routes.js';
import { registerRepositoryRoutes } from '../repository/routes.js';
import type { RunService } from '../runs/run-types.js';
import { registerRunRoutes } from '../runs/routes.js';
import { registerErrorHandler } from './api-error.js';
import { registerLoopbackSecurity } from './loopback-security.js';
import type { AppOptions } from './types.js';

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const repositoryManager = options.repositoryManager ?? getDefaultLocalRepositoryManager();
  const initialRepositoryStatus = await repositoryManager.initialize();
  const localManager = repositoryManager as LocalRepositoryManager;
  const styleGuideService =
    options.styleGuideService === undefined
      ? new LocalStyleGuideService(localManager)
      : options.styleGuideService;
  const presetService =
    options.presetService === undefined
      ? new LocalPresetService(localManager)
      : options.presetService;
  const ownsRunService = options.runService === undefined;
  let runService: RunService | null;
  if (options.runService === undefined) {
    const { LocalRunService } = await import('../runs/run-service.js');
    runService = new LocalRunService({
      manager: localManager,
      ...(styleGuideService ? { styleGuideService } : {}),
    });
  } else {
    runService = options.runService;
  }

  if (ownsRunService && runService && initialRepositoryStatus.active) {
    await runService.recover();
  }

  const app = fastify({
    logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] },
    bodyLimit: 64 * 1024 * 1024,
  });
  registerErrorHandler(app);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'"],
      },
    },
  });
  registerLoopbackSecurity(app);

  const recoverSelectedRepository = async (status: RepositoryStatus): Promise<void> => {
    if (ownsRunService && runService && status.active) await runService.recover();
  };

  registerCapabilityRoutes(app, runService);
  registerRepositoryRoutes(app, { repositoryManager, recoverSelectedRepository });
  registerStyleGuideRoutes(app, styleGuideService);
  registerPresetRoutes(app, presetService);
  registerRunRoutes(app, runService);
  registerImageRoutes(app, runService);
  return app;
}
