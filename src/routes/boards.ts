import { Router } from 'express';
import { BoardController } from '../controllers/boardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All board routes require authentication
router.use(authenticateToken);

// Board CRUD operations
router.post('/', BoardController.createBoard);
router.get('/', BoardController.getBoards);
router.get('/:boardId', BoardController.getBoard);
router.put('/:boardId', BoardController.updateBoard);
router.delete('/:boardId', BoardController.deleteBoard);

export default router;
