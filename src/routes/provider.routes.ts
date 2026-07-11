import { Router } from 'express';
import { ProviderController } from '../controllers/provider.controller';
import { GearController } from '../controllers/gear.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import { gearValidators } from '../validators/gear.validator';
import { rentalValidators } from '../validators/rental.validator';

const router = Router();
const providerController = new ProviderController();
const gearController = new GearController();

router.use(authMiddleware);
router.use(roleMiddleware('PROVIDER'));

// Gear inventory management
router.get('/gear', (req, res) => providerController.getMyGear(req, res));
router.post('/gear', validate(gearValidators.create), (req, res) => gearController.createGear(req, res));
router.put('/gear/:id', validate(gearValidators.update), (req, res) => gearController.updateGear(req, res));
router.delete('/gear/:id', validate(gearValidators.delete), (req, res) => gearController.deleteGear(req, res));

// Order management
router.get('/orders', (req, res) => providerController.getIncomingOrders(req, res));
router.get('/orders/:id', (req, res) => providerController.getOrderDetails(req, res));
router.patch('/orders/:id', validate(rentalValidators.updateStatus), (req, res) => providerController.updateOrderStatus(req, res));

// Stats
router.get('/stats', (req, res) => providerController.getStats(req, res));

export default router;
