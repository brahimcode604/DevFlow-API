import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/http/async-handler';
import { validate } from '../../common/http/validate';
import * as controller from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

const router = Router();
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Try again later.',
        requestId: res.locals.requestId,
      },
    });
  },
});

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.login));

export default router;
