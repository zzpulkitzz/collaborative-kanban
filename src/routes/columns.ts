import { Router } from 'express';
import { ColumnController } from '../controllers/columnController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All column routes require authentication
router.use(authenticateToken);

// Column CRUD operations
router.post('/', ColumnController.createColumn);
router.put('/:columnId', ColumnController.updateColumn);
router.delete('/:columnId', ColumnController.deleteColumn);
router.put('/board/:boardId/reorder', ColumnController.reorderColumns);

export default router;
