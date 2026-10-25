import { z } from 'zod';
import { paginationSchema } from '../../common/http/pagination';

const clientFields = {
  name: z.string().trim().min(1).max(150),
  email: z.string().email().max(254).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
};

export const listClientsSchema = z
  .object({
    body: z.object({}),
    params: z.object({}),
    query: paginationSchema
      .extend({
        search: z.string().trim().max(100).optional(),
        sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
      .strict(),
  })
  .strict();

export const createClientSchema = z
  .object({
    body: z.object(clientFields).strict(),
    params: z.object({}),
    query: z.object({}),
  })
  .strict();

export const updateClientSchema = z
  .object({
    body: z
      .object(clientFields)
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0),
    params: z.object({ clientId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const clientIdSchema = z
  .object({
    body: z.object({}),
    params: z.object({ clientId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export type ClientFields = z.infer<typeof createClientSchema>['body'];
