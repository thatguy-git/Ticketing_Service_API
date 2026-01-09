import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/register', authController.register);

router.post('/verify', authController.verifyEmail);

router.post('/login', authController.login);

export { router as authRoutes };
