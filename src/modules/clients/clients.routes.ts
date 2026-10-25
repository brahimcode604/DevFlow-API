import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/http/async-handler';
import { validate } from '../../common/http/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './clients.controller';
import {
  clientIdSchema,
  createClientSchema,
  listClientsSchema,
  updateClientSchema,
} from './clients.schema';

const router = Router();
router.use(authenticate);
router.get('/', validate(listClientsSchema), asyncHandler(controller.list));
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(createClientSchema),
  asyncHandler(controller.create),
);
router.get('/:clientId', validate(clientIdSchema), asyncHandler(controller.get));
router.patch(
  '/:clientId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateClientSchema),
  asyncHandler(controller.update),
);
router.delete(
  '/:clientId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validate(clientIdSchema),
  asyncHandler(controller.remove),
);

export default router;
