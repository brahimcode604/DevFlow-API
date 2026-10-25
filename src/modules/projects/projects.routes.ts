import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/http/async-handler';
import { validate } from '../../common/http/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './projects.controller';
import {
  addMemberSchema,
  createProjectSchema,
  listMembersSchema,
  listProjectsSchema,
  projectIdSchema,
  removeMemberSchema,
  updateProjectSchema,
} from './projects.schema';

const router = Router();
router.use(authenticate);
router.get('/', validate(listProjectsSchema), asyncHandler(controller.list));
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(createProjectSchema),
  asyncHandler(controller.create),
);
router.get(
  '/:projectId/members',
  validate(listMembersSchema),
  asyncHandler(controller.listMembers),
);
router.post(
  '/:projectId/members',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(addMemberSchema),
  asyncHandler(controller.addMember),
);
router.delete(
  '/:projectId/members/:userId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(removeMemberSchema),
  asyncHandler(controller.removeMember),
);
router.get('/:projectId', validate(projectIdSchema), asyncHandler(controller.get));
router.patch(
  '/:projectId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateProjectSchema),
  asyncHandler(controller.update),
);
router.delete(
  '/:projectId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(projectIdSchema),
  asyncHandler(controller.remove),
);

export default router;
