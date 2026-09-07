import { Router } from 'express';
import { getHealth, getLive, getReady } from './health.controller.js';

const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/live', getLive);
healthRouter.get('/ready', getReady);

export default healthRouter;
