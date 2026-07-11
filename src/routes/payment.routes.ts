import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { paymentValidators } from '../validators/payment.validator';

const router = Router();
const paymentController = new PaymentController();

router.use(authMiddleware);

router.post('/create', validate(paymentValidators.create), (req, res) => paymentController.createPayment(req, res));
router.post('/confirm', validate(paymentValidators.confirm), (req, res) => paymentController.confirmPayment(req, res));
router.get('/', (req, res) => paymentController.getPaymentHistory(req, res));
router.get('/:id', validate(paymentValidators.getById), (req, res) => paymentController.getPaymentDetails(req, res));

export default router;
