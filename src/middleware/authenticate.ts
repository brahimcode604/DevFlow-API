import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../common/errors/app-error';

export type AuthUser = { id: string; role: UserRole };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    return;
  }

  let subject: string;
  try {
    const payload = jwt.verify(authorization.slice(7), env.JWT_SECRET, {
      issuer: 'devflow-api',
      audience: 'devflow-client',
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new Error('Token subject is missing.');
    }
    subject = payload.sub;
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.'));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: subject },
    select: { id: true, role: true, isActive: true },
  });
  if (!user?.isActive) {
    next(new AppError(401, 'UNAUTHENTICATED', 'The account is inactive or unavailable.'));
    return;
  }
  req.user = { id: user.id, role: user.role };
  next();
};
