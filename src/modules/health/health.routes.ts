import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ data: { status: 'ok', database: 'ok' } });
  } catch (error) {
    console.error('Readiness check failed.', error);
    next(new AppError(503, 'SERVICE_UNAVAILABLE', 'The database is unavailable.'));
  }
});

export default router;
