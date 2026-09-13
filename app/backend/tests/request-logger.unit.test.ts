import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestLogger, routeLogContext } from '../src/middleware/requestLogger.js';
import { logger } from '../src/shared/logger.js';

describe('Request log privacy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs configured mount and endpoint patterns without IDs or query values', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = express();
    const router = express.Router({ mergeParams: true });
    app.use(requestLogger);
    router.get('/:category', (_req, res) => res.sendStatus(200));
    app.use('/accounts/:accountId/files', routeLogContext('/accounts/:accountId/files'), router);
    await request(app).get('/accounts/private-account/files/private-category?q=private-email');
    const serialized = JSON.stringify(info.mock.calls);
    for (const value of ['private-account', 'private-category', 'private-email']) {
      expect(serialized).not.toContain(value);
    }
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/accounts/:accountId/files/:category',
        status: 200,
      }),
      expect.any(String),
    );
  });

  it('uses UNMATCHED for unknown URLs and does not log their raw paths', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = express();
    app.use(requestLogger);
    await request(app).get('/unknown/private-id?token=private-token').expect(404);
    expect(JSON.stringify(info.mock.calls)).not.toContain('private-');
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'UNMATCHED', status: 404 }),
      expect.any(String),
    );
  });
});
