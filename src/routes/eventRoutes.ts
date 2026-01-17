import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { checkRole } from '../middlewares/roleMiddleware';
const router = Router();

// Public Routes
router.get('/', eventController.getEvents);
router.get('/:id/seats', eventController.getEventSeats);

// Admin Routes
router.post(
    '/',
    authenticateToken,
    checkRole(['ADMIN', 'ORGANIZER']),
    eventController.createEvent
);

export { router as eventRoutes };
