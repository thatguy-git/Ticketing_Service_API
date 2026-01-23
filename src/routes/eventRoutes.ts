import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { checkRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate.input';
import { createEventValidationSchema } from '../utils/validationSchemas';

const router = Router();

// Public Routes
router.get('/', eventController.getEvents);
router.get('/seats/:id', eventController.getEventSeats);

// Admin Routes
router.post(
    '/',
    authenticateToken,
    checkRole(['ADMIN', 'ORGANIZER']),
    validate(createEventValidationSchema),
    eventController.createEvent,
);

export { router as eventRoutes };
