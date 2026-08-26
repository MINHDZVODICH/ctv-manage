import { Router } from 'express';
import * as usersController from './users.controller.js';
import { auth } from '../../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(auth);

router.get('/', usersController.getMe);
router.patch('/', usersController.patchMe);
router.post('/password-changes', usersController.postPasswordChange);

export default router;
