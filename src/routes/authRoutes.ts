import { Router } from 'express';
import * as authController from '../controllers/authController';
import { validate } from '../middlewares/validate.input';
import {
    registerValidationSchema,
    verifyEmailValidationSchema,
    loginValidationSchema,
} from '../utils/validationSchemas';

const router = Router();

router.post(
    '/register',
    validate(registerValidationSchema),
    authController.register,
);

router.post(
    '/verify',
    validate(verifyEmailValidationSchema),
    authController.verifyEmail,
);

router.post('/login', validate(loginValidationSchema), authController.login);

export { router as authRoutes };
