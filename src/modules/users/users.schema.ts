import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../common/http/pagination';

export const listUsersSchema = z
  .object({
    body: z.object({}),
    params: z.object({}),
    query: paginationSchema
      .extend({
        role: z.nativeEnum(UserRole).optional(),
        isActive: z.enum(['true', 'false']).optional(),
      })
      .strict(),
  })
  .strict();

export const updateRoleSchema = z
  .object({
    body: z.object({ role: z.nativeEnum(UserRole) }).strict(),
    params: z.object({ userId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();
