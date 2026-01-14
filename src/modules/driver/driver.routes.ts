import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  updateDriverStatus,
  getDriverRequests,
  acceptRide,
  startRide,
  completeRide,
  getDriverRideDetails,
  getDriverEarnings,
  getDriverStats,
} from './driver.controller';

const router = Router();

// All routes require authentication and driver role
router.use(authenticate, requireRole('driver'));

router.put('/status', updateDriverStatus);
router.get('/requests', getDriverRequests);
router.get('/ride/:rideId', getDriverRideDetails);
router.post('/accept/:rideId', acceptRide);
router.post('/start/:rideId', startRide);
router.post('/complete/:rideId', completeRide);
router.get('/earnings', getDriverEarnings);
router.get('/stats', getDriverStats);

export default router;
