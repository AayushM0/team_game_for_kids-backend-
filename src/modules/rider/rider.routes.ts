import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  getNearbyDrivers,
  requestRide,
  getRideDetails,
  getRideHistory,
  cancelRideByRider,
  getRidePayment,
  markPaymentPaid,
  getRecentLocations,
  rateDriver,
} from './rider.controller';

const router = Router();

// All routes require authentication and rider role
router.use(authenticate, requireRole('rider'));

router.get('/nearby-drivers', getNearbyDrivers);
router.post('/request-ride', requestRide);
router.get('/trip/:id', getRideDetails);
router.get('/history', getRideHistory);
router.post('/cancel/:id', cancelRideByRider);
router.get('/payment/:id', getRidePayment);
router.post('/payment/:id/pay', markPaymentPaid);
router.get('/recent-locations', getRecentLocations);
router.post('/rate-driver/:rideId', rateDriver);

export default router;
