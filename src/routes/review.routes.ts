import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import { reviewValidators } from '../validators/review.validator';

const router = Router();
const reviewController = new ReviewController();

router.get('/gear/:gearId', validate(reviewValidators.getByGear), (req, res) => reviewController.getGearReviews(req, res));

router.use(authMiddleware);

router.get('/me', (req, res) => reviewController.getMyReviews(req, res));
router.post('/', roleMiddleware('CUSTOMER'), validate(reviewValidators.create), (req, res) => reviewController.createReview(req, res));
router.patch('/:id', validate(reviewValidators.update), (req, res) => reviewController.updateReview(req, res));
router.delete('/:id', validate(reviewValidators.delete), (req, res) => reviewController.deleteReview(req, res));

export default router;
