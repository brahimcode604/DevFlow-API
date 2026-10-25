import { Prisma } from '@prisma/client';
import { AppError } from './app-error';

export function mapPrismaError(error: unknown): AppError | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;

  if (error.code === 'P2002')
    return new AppError(409, 'CONFLICT', 'A resource with these values already exists.');
  if (error.code === 'P2025') return new AppError(404, 'NOT_FOUND', 'Resource not found.');
  if (error.code === 'P2003')
    return new AppError(409, 'CONFLICT', 'The operation conflicts with related resources.');
  if (error.code === 'P2014')
    return new AppError(409, 'CONFLICT', 'The operation violates a relation constraint.');
  if (error.code === 'P2034')
    return new AppError(
      409,
      'TRANSACTION_CONFLICT',
      'The resource changed during the operation. Retry the request.',
    );
  return undefined;
}
