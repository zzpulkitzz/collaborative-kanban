import { Router } from 'express';
import { CardController } from '../controllers/cardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All card routes require authentication
router.use(authenticateToken);

// Card CRUD operations
router.post('/', CardController.createCard);
router.put('/:cardId', CardController.updateCard);
router.post('/move', CardController.moveCard);
router.delete('/:cardId', CardController.deleteCard);

export default router;
