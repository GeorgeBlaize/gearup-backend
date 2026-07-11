import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { authValidators } from '../validators/auth.validator';

const router = Router();
const authController = new AuthController();

router.post('/register', validate(authValidators.register), (req, res) => authController.register(req, res));
router.post('/login', validate(authValidators.login), (req, res) => authController.login(req, res));
router.get('/me', authMiddleware, (req, res) => authController.getMe(req, res));

export default router;
