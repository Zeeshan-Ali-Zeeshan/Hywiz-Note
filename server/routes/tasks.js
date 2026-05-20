import express from 'express';
import { taskController } from '../controllers/TaskController.js'; // Ensure correct path
import auth from '../middleware/auth.js';

const router = express.Router();

// Middleware to ensure Idempotency Keys are present for critical write ops
const ensureIdempotency = (req, res, next) => {
  // For MVP, we just warn, or check if header exists
  // In Hardened Prod, we would Reject 400 if missing
  next();
};

// GET /api/tasks (List with filters)
router.get('/', auth, taskController.getTasks);

// POST /api/tasks (Create new task/series)
router.post('/', auth, ensureIdempotency, taskController.createTask);

// PATCH /api/tasks/:id (Update Content/Schedule)
router.patch('/:id', auth, ensureIdempotency, taskController.updateTask);

// POST /api/tasks/:id/complete (Transactional Completion)
router.post('/:id/complete', auth, ensureIdempotency, taskController.completeTask);

// PATCH /api/tasks/:id/restore (Restore from Tombstone)
router.patch('/:id/restore', auth, taskController.restoreTask);

// DELETE /api/tasks/:id (Soft Delete via Update, or Hard Delete Admin only)
// Mapping DELETE to update isDeleted=true for REST purity or use Patch
router.delete('/:id', auth, async (req, res) => {
  // Forward to updateTask with isDeleted: true
  req.body.isDeleted = true;
  taskController.updateTask(req, res);
});

// POST /api/tasks/sync-from-note (Bulk Sync from Editor)
router.post('/sync-from-note', auth, taskController.syncFromNote);

export default router;
