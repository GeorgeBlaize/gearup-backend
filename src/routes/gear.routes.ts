import { Router } from 'express';
import { GearController } from '../controllers/gear.controller';
import { validate } from '../middleware/validation.middleware';
import { gearValidators } from '../validators/gear.validator';

const router = Router();
const gearController = new GearController();

router.get('/', (req, res) => gearController.getAllGear(req, res));
router.get('/:id', validate(gearValidators.getById), (req, res) => gearController.getGearById(req, res));

export default router;
