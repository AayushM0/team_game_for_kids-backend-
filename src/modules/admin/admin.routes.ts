import { Router } from 'express';
import {
  getAllUsers,
  getAllRides,
  getSystemStats,
  getRideById,
  getUserById,
} from './admin.controller';

const router = Router();

// Note: In production, add admin authentication middleware
// For now, these routes are open for development purposes

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.get('/rides', getAllRides);
router.get('/rides/:id', getRideById);
router.get('/stats', getSystemStats);

export default router;
