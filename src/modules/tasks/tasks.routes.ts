import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/http/async-handler';
import { validate } from '../../common/http/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './tasks.controller';
import {
  createTaskSchema,
  listTasksSchema,
  taskIdSchema,
  updateAssigneeSchema,
  updateStatusSchema,
  updateTaskSchema,
} from './tasks.schema';

const router = Router();
router.use(authenticate);
router.get('/projects/:projectId/tasks', validate(listTasksSchema), asyncHandler(controller.list));
router.post(
  '/projects/:projectId/tasks',
  validate(createTaskSchema),
  asyncHandler(controller.create),
);
router.patch(
  '/tasks/:taskId/assignee',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateAssigneeSchema),
  asyncHandler(controller.assign),
);
router.patch(
  '/tasks/:taskId/status',
  validate(updateStatusSchema),
  asyncHandler(controller.updateStatus),
);
router.get('/tasks/:taskId', validate(taskIdSchema), asyncHandler(controller.get));
router.patch('/tasks/:taskId', validate(updateTaskSchema), asyncHandler(controller.update));

export default router;
