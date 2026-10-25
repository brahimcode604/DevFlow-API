import { Router } from 'express';
import { asyncHandler } from '../../common/http/async-handler';
import { validate } from '../../common/http/validate';
import { authenticate } from '../../middleware/authenticate';
import { overview } from './analytics.controller';
import { overviewSchema } from './analytics.schema';

const router = Router();
router.get('/overview', authenticate, validate(overviewSchema), asyncHandler(overview));
export default router;
