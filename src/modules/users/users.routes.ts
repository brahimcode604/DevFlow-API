import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/http/async-handler';
import { validate } from '../../common/http/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './users.controller';
import { listUsersSchema, updateRoleSchema } from './users.schema';

const router = Router();
router.get('/me', authenticate, asyncHandler(controller.me));
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(listUsersSchema),
  asyncHandler(controller.list),
);
router.patch(
  '/:userId/role',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(updateRoleSchema),
  asyncHandler(controller.updateRole),
);

export default router;
