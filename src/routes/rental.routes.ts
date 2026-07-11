import { Router } from 'express';
import { RentalController } from '../controllers/rental.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import { rentalValidators } from '../validators/rental.validator';

const router = Router();
const rentalController = new RentalController();

router.use(authMiddleware);

router.post('/', roleMiddleware('CUSTOMER'), validate(rentalValidators.create), (req, res) => rentalController.createRental(req, res));
router.get('/', (req, res) => rentalController.getMyRentals(req, res));
router.get('/availability', validate(rentalValidators.checkAvailability), (req, res) => rentalController.checkAvailability(req, res));
router.get('/:id', validate(rentalValidators.getById), (req, res) => rentalController.getRentalDetails(req, res));
router.patch('/:id/cancel', roleMiddleware('CUSTOMER'), validate(rentalValidators.cancel), (req, res) => rentalController.cancelRental(req, res));

export default router;
