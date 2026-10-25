import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import type { LoginInput, RegisterInput } from './auth.schema';

function createToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    issuer: 'devflow-api',
    audience: 'devflow-client',
  });
}

export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing)
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { email, name: input.name, passwordHash, role: UserRole.MEMBER },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return { user, accessToken: createToken(user.id), tokenType: 'Bearer' as const };
}

export async function login(input: LoginInput) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const isValid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !user.isActive || !isValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken: createToken(user.id),
    tokenType: 'Bearer' as const,
  };
}
