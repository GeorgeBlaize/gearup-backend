import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';

const router = Router();
const adminController = new AdminController();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', adminController.updateUserStatus);

// Gear management
router.get('/gear', adminController.getAllGear);
router.delete('/gear/:id', adminController.deleteGearItem);

// Rental management
router.get('/rentals', adminController.getAllRentals);
router.get('/rentals/:id', adminController.getRentalById);
router.patch('/rentals/:id/status', adminController.updateRentalStatus);

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

export default router;